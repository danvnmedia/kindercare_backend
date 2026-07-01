import { BadRequestException, NotFoundException } from "@nestjs/common";

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
const ACTOR_NAME = "Alice Nguyen";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_audit12345",
      isActive: true,
      profile: {
        type: "staff",
        id: ACTOR_ID,
        fullName: ACTOR_NAME,
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

describe("RemoveUsersFromRoleUseCase", () => {
  let useCase: RemoveUsersFromRoleUseCase;
  let roleRepo: jest.Mocked<RoleRepository>;
  let userRepo: jest.Mocked<UserRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  const campusId = "11111111-1111-4111-a111-111111111111";
  const otherCampusId = "22222222-2222-4222-a222-222222222222";
  const roleId = "role-1";

  beforeEach(() => {
    roleRepo = createMockRoleRepository();
    userRepo = createMockUserRepository();

    mockTx = {
      revokeRoles: jest.fn().mockResolvedValue(1),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;

    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    actor = buildActor();

    useCase = new RemoveUsersFromRoleUseCase(roleRepo, userRepo, unitOfWork);
  });

  describe("Phase 1 — pre-validation (outside UoW)", () => {
    it("AC-7 — rejects system roles (campusId=null) with 400; UoW never runs", async () => {
      roleRepo.findById.mockResolvedValue({
        id: roleId,
        campusId: null,
      } as never);

      await expect(
        useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor),
      ).rejects.toThrow(BadRequestException);
      await expect(
        useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor),
      ).rejects.toThrow(/system roles/i);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.revokeRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("AC-8 — rejects cross-campus role with 400 naming both campus IDs; UoW never runs", async () => {
      roleRepo.findById.mockResolvedValue({
        id: roleId,
        campusId: otherCampusId,
      } as never);

      const promise = useCase.execute(
        { roleId, userIds: ["user-1"], campusId },
        actor,
      );

      await expect(promise).rejects.toThrow(BadRequestException);
      // Message must name BOTH the role's home campus and the requested
      // campus so the FE can surface a clear "wrong campus" error.
      await expect(promise).rejects.toThrow(
        new RegExp(
          `${otherCampusId}.*${campusId}|${campusId}.*${otherCampusId}`,
        ),
      );

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.revokeRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("AC-9 — throws NotFoundException on first missing user; UoW never runs", async () => {
      roleRepo.findById.mockResolvedValue({
        id: roleId,
        campusId,
      } as never);
      // user-1 exists, user-2 missing → abort before entering the UoW.
      userRepo.findById
        .mockResolvedValueOnce({ id: "user-1" } as never)
        .mockResolvedValueOnce(null);

      await expect(
        useCase.execute(
          { roleId, userIds: ["user-1", "user-2"], campusId },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(userRepo.findById).toHaveBeenCalledTimes(2);
      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.revokeRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("rejects 404 when the role itself does not exist (covers role-pre-validate path)", async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor),
      ).rejects.toThrow(NotFoundException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Phase 2 — UoW deletes + audits", () => {
    beforeEach(() => {
      roleRepo.findById.mockResolvedValue({
        id: roleId,
        campusId,
      } as never);
      userRepo.findById.mockImplementation((id: string) =>
        Promise.resolve({ id } as never),
      );
    });

    it("AC-10 — happy-path single user: tx.revokeRoles called with natural key; tx.recordAudit emits REVOKE_ROLE", async () => {
      mockTx.revokeRoles.mockResolvedValue(1);

      await useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor);

      expect(mockTx.revokeRoles).toHaveBeenCalledTimes(1);
      // Removal shape: `(roleId, campusId)` — no provenance filter at this
      // layer (Scenario 9: admin revoke matches BOTH manual and tracked rows
      // by natural key; the port's `revokeRoles` deletes regardless of
      // `granted_via_staff_type_id`).
      expect(mockTx.revokeRoles).toHaveBeenCalledWith("user-1", [
        { roleId, campusId },
      ]);

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload).toEqual({
        actorId: ACTOR_ID,
        action: "REVOKE_ROLE",
        targetType: "user",
        targetId: "user-1",
        campusId,
        context: {
          roleId,
          campusId,
          actorName: ACTOR_NAME,
        },
      });
    });

    it("AC-11 — happy-path batch: N users → N deletes + N audits with distinct targetIds", async () => {
      mockTx.revokeRoles.mockResolvedValue(1);
      const userIds = ["user-1", "user-2", "user-3"];

      await useCase.execute({ roleId, userIds, campusId }, actor);

      expect(mockTx.revokeRoles).toHaveBeenCalledTimes(3);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(3);

      // D1 of spec: per-pair granularity — one audit row per user.
      const auditedTargetIds = mockTx.recordAudit.mock.calls.map(
        (call) => call[0].targetId,
      );
      expect(auditedTargetIds).toEqual(userIds);

      // Each audit emits with the same role/campus context.
      for (const call of mockTx.recordAudit.mock.calls) {
        const payload = call[0];
        expect(payload.action).toBe("REVOKE_ROLE");
        expect(payload.targetType).toBe("user");
        expect(payload.campusId).toBe(campusId);
        expect(payload.context).toEqual({
          roleId,
          campusId,
          actorName: ACTOR_NAME,
        });
      }
    });

    it("AC-12 — D4 revoke miss: tx.revokeRoles returns 0 → no audit row for that user", async () => {
      // The user never held this role-campus pair → revoke is a no-op and
      // the audit log stays silent (D4 — mirror of D5 conflict suppression
      // on the grant side).
      mockTx.revokeRoles.mockResolvedValue(0);

      await useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor);

      expect(mockTx.revokeRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("AC-13 — Scenario 9: revoke of tracked-provenance row succeeds and audits (admin-override semantics)", async () => {
      // From the use-case's standpoint, a tracked-provenance row is
      // indistinguishable from a manual row at the call site — the port
      // filters on `(userId, roleId, campusId)` only. The use case asks for
      // a deletion by natural key and trusts the port; the row gets deleted
      // (deleted=1) regardless of `granted_via_staff_type_id`, and the
      // audit emits exactly as for a manual revoke. This locks down the
      // contract: no extra provenance-aware branching at this layer.
      mockTx.revokeRoles.mockResolvedValue(1);

      await useCase.execute({ roleId, userIds: ["user-3"], campusId }, actor);

      // Call shape is identical to AC-10 — no extra provenance argument.
      expect(mockTx.revokeRoles).toHaveBeenCalledWith("user-3", [
        { roleId, campusId },
      ]);
      // Audit emits — admin override is a real state change.
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("REVOKE_ROLE");
      expect(payload.targetId).toBe("user-3");
    });

    it("AC-11 mixed batch: audit count equals delete count, NOT request count", async () => {
      // user-1 deletes, user-2 misses (D4), user-3 deletes → 2 audits.
      // Locks down per-iteration gating: a single 0-return inside the batch
      // must not silence subsequent audits.
      mockTx.revokeRoles
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      await useCase.execute(
        { roleId, userIds: ["user-1", "user-2", "user-3"], campusId },
        actor,
      );

      expect(mockTx.revokeRoles).toHaveBeenCalledTimes(3);
      // Exactly 2 audit rows — D4 suppression keeps user-2 silent.
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(2);

      const auditedTargetIds = mockTx.recordAudit.mock.calls.map(
        (call) => call[0].targetId,
      );
      expect(auditedTargetIds).toEqual(["user-1", "user-3"]);
    });

    it("actorName falls back to null when the actor has no profile.fullName", async () => {
      // Locks down the `currentUser.profile?.fullName ?? null` shape so a
      // future Profile schema change cannot silently break audit payloads.
      const actorWithoutName = User.reconstitute(
        {
          clerkUid: "user_no_name",
          isActive: true,
          profile: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        ACTOR_ID,
      );
      mockTx.revokeRoles.mockResolvedValue(1);

      await useCase.execute(
        { roleId, userIds: ["user-1"], campusId },
        actorWithoutName,
      );

      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.context).toEqual({
        roleId,
        campusId,
        actorName: null,
      });
    });
  });
});
