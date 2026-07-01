import { BadRequestException, NotFoundException } from "@nestjs/common";

import { AssignUsersToRoleUseCase } from "./assign-users-to-role.use-case";
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

describe("AssignUsersToRoleUseCase", () => {
  let useCase: AssignUsersToRoleUseCase;
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
      assignRoles: jest.fn().mockResolvedValue(1),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;

    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    actor = buildActor();

    useCase = new AssignUsersToRoleUseCase(roleRepo, userRepo, unitOfWork);
  });

  describe("Phase 1 — pre-validation (outside UoW)", () => {
    it("AC-9 — rejects system roles (campusId=null) with 400; UoW never runs", async () => {
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
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("AC-10 — rejects cross-campus role with 400 naming both campus IDs; UoW never runs", async () => {
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
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("AC-11 — throws NotFoundException on first missing user; UoW never runs", async () => {
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
      expect(mockTx.assignRoles).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("rejects 404 when the role itself does not exist (prerequisite for AC-2/AC-3 path)", async () => {
      roleRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor),
      ).rejects.toThrow(NotFoundException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Phase 2 — UoW writes + audits", () => {
    beforeEach(() => {
      roleRepo.findById.mockResolvedValue({
        id: roleId,
        campusId,
      } as never);
      userRepo.findById.mockImplementation((id: string) =>
        Promise.resolve({ id } as never),
      );
    });

    it("AC-12 — happy-path single user: tx.assignRoles called with full provenance shape; tx.recordAudit emits GRANT_ROLE", async () => {
      mockTx.assignRoles.mockResolvedValue(1);

      await useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor);

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.assignRoles).toHaveBeenCalledWith("user-1", [
        {
          roleId,
          campusId,
          // null marks this as a manual grant (D6 of tracked-grant-revocation:
          // never auto-revoked by a future staff-type change).
          grantedViaStaffTypeId: null,
        },
      ]);

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload).toEqual({
        actorId: ACTOR_ID,
        action: "GRANT_ROLE",
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

    it("AC-13 — happy-path batch: N users → N inserts + N audits with distinct targetIds", async () => {
      mockTx.assignRoles.mockResolvedValue(1);
      const userIds = ["user-1", "user-2", "user-3"];

      await useCase.execute({ roleId, userIds, campusId }, actor);

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(3);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(3);

      // D1 of spec: per-pair granularity — one audit row per user.
      const auditedTargetIds = mockTx.recordAudit.mock.calls.map(
        (call) => call[0].targetId,
      );
      expect(auditedTargetIds).toEqual(userIds);

      // Each audit emits with the same role/campus context.
      for (const call of mockTx.recordAudit.mock.calls) {
        const payload = call[0];
        expect(payload.action).toBe("GRANT_ROLE");
        expect(payload.targetType).toBe("user");
        expect(payload.campusId).toBe(campusId);
        expect(payload.context).toEqual({
          roleId,
          campusId,
          actorName: ACTOR_NAME,
        });
      }
    });

    it("AC-14 — D5 conflict no-op: assignRoles returns 0 → no audit row for that user", async () => {
      // Manual or tracked row already holds the (user, role, campus) tuple
      // → skipDuplicates suppresses the insert and count=0 silences the audit.
      mockTx.assignRoles.mockResolvedValue(0);

      await useCase.execute({ roleId, userIds: ["user-1"], campusId }, actor);

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });

    it("AC-15 — mixed batch: audit count equals insert count, NOT request count", async () => {
      // user-1 inserts, user-2 collides (D5), user-3 inserts → 2 audits.
      mockTx.assignRoles
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1);

      await useCase.execute(
        { roleId, userIds: ["user-1", "user-2", "user-3"], campusId },
        actor,
      );

      expect(mockTx.assignRoles).toHaveBeenCalledTimes(3);
      // Exactly 2 audit rows — D4 no-op suppression keeps user-2 silent.
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
      mockTx.assignRoles.mockResolvedValue(1);

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
