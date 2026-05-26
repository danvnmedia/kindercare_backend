/**
 * Role-assignment atomicity — integration coverage for
 * @doc/specs/direct-role-assignment-via-uow Scenario 6 + NFR-1.
 *
 * What this locks down: when a per-user op inside the UoW closure throws
 * mid-batch, the use case rejects and a real Prisma `$transaction` rolls back
 * EVERYTHING — every user_roles mutation already issued AND every audit row
 * already emitted in the same closure. The mock-level proof is structural:
 * any pre-throw `recordAudit` call MUST live inside the same closure that
 * ultimately threw, so a real DB discards it along with the failed insert.
 *
 * Sibling pattern: `update-staff-tracked-grant.integration.spec.ts` (single-
 * pair variant where `assignRoles` throws on the only call) and
 * `audit-atomicity.integration.spec.ts` (cross-group recorder-throws variant).
 * This file covers the batched, per-user-loop variant unique to the
 * direct-role-assignment endpoints.
 *
 * Mock-vs-real-DB note: at the unit-mock level a pre-throw audit DOES fire
 * for u1 — the assertion below pins that to exactly 1 call. The "audit row
 * never lands in the DB" claim is what Prisma `$transaction` guarantees once
 * the closure throws; this test proves the necessary local condition (the
 * audit row lived inside the throwing closure), not the DB-layer rollback
 * itself. No real-DB harness exists in this repo — every sibling
 * `*.integration.spec.ts` follows this convention.
 */

import { AssignUsersToRoleUseCase } from "./assign-users-to-role.use-case";
import { RemoveUsersFromRoleUseCase } from "./remove-users-from-role.use-case";
import { RoleRepository } from "../../ports/role.repository";
import { UserRepository } from "../../ports/user.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import {
  createMockRoleRepository,
  createMockUserRepository,
} from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const ROLE_ID = "role-1";
const USER_IDS = ["u1", "u2", "u3"];

const ROLE_ERROR = new Error("role-mutation failure (rollback probe)");

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
      isActive: true,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        fullName: "Alice Nguyen",
        email: null,
        phoneNumber: null,
        dateOfBirth: null,
        gender: null,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    ACTOR_ID,
  );
}

function buildPassingRepos(): {
  roleRepo: jest.Mocked<RoleRepository>;
  userRepo: jest.Mocked<UserRepository>;
} {
  const roleRepo = createMockRoleRepository();
  roleRepo.findById.mockResolvedValue({
    id: ROLE_ID,
    campusId: CAMPUS_ID,
  } as never);

  const userRepo = createMockUserRepository();
  userRepo.findById.mockImplementation((id: string) =>
    Promise.resolve({ id } as never),
  );

  return { roleRepo, userRepo };
}

describe("Role assignment atomicity — direct-role-assignment-via-uow Scenario 6 / NFR-1", () => {
  it("grant-side mid-batch throw: tx.assignRoles fails on user 2 → use case rejects; pre-throw audit (u1) ran inside the throwing closure; user 3 never reached", async () => {
    const { roleRepo, userRepo } = buildPassingRepos();

    // assignRoles: succeeds for u1 (returns 1 → audit fires), throws on u2.
    const assignSpy = jest
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(ROLE_ERROR);
    const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
    const mockTx = {
      assignRoles: assignSpy,
      recordAudit: recordAuditSpy,
    } as unknown as TransactionContext;

    const runSpy = jest.fn(
      (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
    );
    const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

    const useCase = new AssignUsersToRoleUseCase(
      roleRepo,
      userRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        { roleId: ROLE_ID, userIds: USER_IDS, campusId: CAMPUS_ID },
        buildActor(),
      ),
    ).rejects.toThrow(ROLE_ERROR.message);

    // The UoW closure was entered exactly once.
    expect(runSpy).toHaveBeenCalledTimes(1);

    // assignRoles fired for u1 (succeeded) and u2 (threw). u3 never reached
    // — the throw on call 2 short-circuited the for-loop.
    expect(assignSpy).toHaveBeenCalledTimes(2);
    expect(assignSpy).toHaveBeenNthCalledWith(1, "u1", [
      {
        roleId: ROLE_ID,
        campusId: CAMPUS_ID,
        grantedViaStaffTypeId: null,
      },
    ]);
    expect(assignSpy).toHaveBeenNthCalledWith(2, "u2", [
      {
        roleId: ROLE_ID,
        campusId: CAMPUS_ID,
        grantedViaStaffTypeId: null,
      },
    ]);

    // recordAudit fired exactly once — for u1, before u2's assignRoles threw.
    // This is the structural rollback proof: u1's audit row lived INSIDE the
    // same UoW closure that ultimately threw, so a real Prisma `$transaction`
    // discards it together with u1's user_roles insert and the failed u2
    // insert. Net DB effect of the batch: zero new user_roles rows + zero new
    // audit rows.
    expect(recordAuditSpy).toHaveBeenCalledTimes(1);
    const payload = recordAuditSpy.mock.calls[0]![0];
    expect(payload.action).toBe("GRANT_ROLE");
    expect(payload.targetType).toBe("user");
    expect(payload.targetId).toBe("u1");
    expect(payload.campusId).toBe(CAMPUS_ID);
  });

  it("revoke-side mid-batch throw: tx.revokeRoles fails on user 2 → use case rejects; pre-throw audit (u1) ran inside the throwing closure; user 3 never reached", async () => {
    const { roleRepo, userRepo } = buildPassingRepos();

    // revokeRoles: succeeds for u1 (returns 1 → audit fires), throws on u2.
    const revokeSpy = jest
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(ROLE_ERROR);
    const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
    const mockTx = {
      revokeRoles: revokeSpy,
      recordAudit: recordAuditSpy,
    } as unknown as TransactionContext;

    const runSpy = jest.fn(
      (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
    );
    const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

    const useCase = new RemoveUsersFromRoleUseCase(
      roleRepo,
      userRepo,
      unitOfWork,
    );

    await expect(
      useCase.execute(
        { roleId: ROLE_ID, userIds: USER_IDS, campusId: CAMPUS_ID },
        buildActor(),
      ),
    ).rejects.toThrow(ROLE_ERROR.message);

    expect(runSpy).toHaveBeenCalledTimes(1);

    // revokeRoles fired for u1 (succeeded) and u2 (threw). u3 never reached.
    // No `grantedViaStaffTypeId` on the removal payload — Scenario 9
    // admin-override semantics: the port deletes by natural key only.
    expect(revokeSpy).toHaveBeenCalledTimes(2);
    expect(revokeSpy).toHaveBeenNthCalledWith(1, "u1", [
      { roleId: ROLE_ID, campusId: CAMPUS_ID },
    ]);
    expect(revokeSpy).toHaveBeenNthCalledWith(2, "u2", [
      { roleId: ROLE_ID, campusId: CAMPUS_ID },
    ]);

    // Same structural rollback proof as the grant side — u1's REVOKE_ROLE
    // audit lived in the throwing closure, so a real DB discards it together
    // with u1's user_roles delete and the failed u2 delete.
    expect(recordAuditSpy).toHaveBeenCalledTimes(1);
    const payload = recordAuditSpy.mock.calls[0]![0];
    expect(payload.action).toBe("REVOKE_ROLE");
    expect(payload.targetType).toBe("user");
    expect(payload.targetId).toBe("u1");
    expect(payload.campusId).toBe(CAMPUS_ID);
  });
});
