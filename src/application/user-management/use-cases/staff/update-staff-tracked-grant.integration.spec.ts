/**
 * Tracked-grant atomicity — integration coverage for
 * @doc/specs/tracked-grant-revocation AC-15.
 *
 * What this locks down: when the role-mutation step inside the UoW throws,
 * the whole transaction closure aborts — so the staff update, the audit row,
 * and any `user_roles` mutation all roll back at the DB layer.
 *
 * The existing `audit-atomicity.integration.spec.ts` covers the
 * `recordAudit`-throws variant of this invariant. This file covers the
 * `tx.assignRoles`-throws variant for `UpdateStaffUseCase` — the specific
 * failure point the tracked-grant spec calls out, where a real PG would
 * raise on the new `(userId, roleId, campusId)` insert (e.g. FK violation,
 * deadlock).
 *
 * Pattern mirrors the audit-atomicity suite: stub the UoW's `run` to invoke
 * the closure synchronously against a fake `tx`, force the failing op to
 * throw, then assert (a) the use case rejects, (b) `tx.updateStaff` ran
 * before the throw — i.e. it lived inside the closure that ultimately
 * aborted — and (c) `tx.recordAudit` did NOT run.
 */

import { UpdateStaffUseCase } from "./update-staff.use-case";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { UserRepository } from "../../ports/user.repository";
import { RoleRepository } from "../../ports/role.repository";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import {
  createStaff,
  createMockStaffRepository,
  createMockUserRepository,
  createMockRoleRepository,
} from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const USER_ID = "user-1";

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

describe("UpdateStaffUseCase — tracked-grant atomicity (tracked-grant-revocation AC-15)", () => {
  it("assignRoles failure inside the UoW propagates and the staff write ran in the same closure (audit + downstream calls did not)", async () => {
    const staffRepo = createMockStaffRepository();
    staffRepo.findById.mockResolvedValue(
      createStaff({
        id: "staff-1",
        campusId: CAMPUS_ID,
        staffTypeId: "type-old",
        userId: USER_ID,
      }),
    );

    const staffTypeRepo = {
      findById: jest.fn().mockImplementation((id: string) =>
        Promise.resolve(
          id === "type-old"
            ? ({
                id: "type-old",
                name: "Old",
                campusId: CAMPUS_ID,
                isArchived: false,
                defaultRoleId: "role-old",
              } as never)
            : ({
                id: "type-new",
                name: "New",
                campusId: CAMPUS_ID,
                isArchived: false,
                defaultRoleId: "role-new",
              } as never),
        ),
      ),
    } as unknown as jest.Mocked<StaffTypeRepository>;

    const userRepo = createMockUserRepository();
    const roleRepo = createMockRoleRepository();
    roleRepo.findById.mockResolvedValue({ id: "role-new" } as never);

    const ROLE_ERROR = new Error("assignRoles failure (rollback probe)");

    const updateStaffSpy = jest.fn().mockResolvedValue({ id: "staff-1" });
    const revokeSpy = jest.fn().mockResolvedValue(0);
    const assignSpy = jest.fn().mockRejectedValue(ROLE_ERROR);
    const recordAuditSpy = jest.fn().mockResolvedValue(undefined);
    const mockTx = {
      updateStaff: updateStaffSpy,
      revokeRolesByProvenance: revokeSpy,
      assignRoles: assignSpy,
      recordAudit: recordAuditSpy,
    } as unknown as TransactionContext;

    const runSpy = jest.fn(
      (task: (tx: TransactionContext) => Promise<unknown>) => task(mockTx),
    );
    const unitOfWork = { run: runSpy } as unknown as UnitOfWorkPort;

    const identityPort = {
      updateUser: jest.fn().mockResolvedValue(undefined),
    } as unknown as IdentityPort;

    const useCase = new UpdateStaffUseCase(
      staffRepo,
      staffTypeRepo,
      userRepo,
      roleRepo,
      unitOfWork,
      identityPort,
    );

    await expect(
      useCase.execute(
        "staff-1",
        { campusId: CAMPUS_ID, staffTypeId: "type-new" },
        buildActor(),
      ),
    ).rejects.toThrow(ROLE_ERROR.message);

    // The UoW closure was entered exactly once.
    expect(runSpy).toHaveBeenCalledTimes(1);
    // The staff write was issued inside the closure (a real DB would roll
    // this back; the unit-level proof is that it lived inside the same
    // closure that ultimately threw).
    expect(updateStaffSpy).toHaveBeenCalledTimes(1);
    // The revoke step ran (it precedes assign in the helper).
    expect(revokeSpy).toHaveBeenCalledWith(USER_ID, "type-old");
    // The failure point.
    expect(assignSpy).toHaveBeenCalledTimes(1);
    // Audit never reached — anything after `assignRoles` in the closure was
    // skipped because the throw propagated.
    expect(recordAuditSpy).not.toHaveBeenCalled();
  });
});
