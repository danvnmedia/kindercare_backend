import { NotFoundException } from "@nestjs/common";

import { UpdateGuardianUseCase } from "./update-guardian.use-case";
import { GuardianRepository } from "../../ports/guardian.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { createGuardian, createMockGuardianRepository } from "@/test-utils";

const ACTOR_ID = "actor-1";

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

describe("UpdateGuardianUseCase", () => {
  let useCase: UpdateGuardianUseCase;
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    guardianRepo = createMockGuardianRepository();
    mockTx = {
      updateGuardian: jest.fn().mockResolvedValue({ id: "guardian-1" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    useCase = new UpdateGuardianUseCase(guardianRepo, unitOfWork);
  });

  describe("DB-only path (no User account)", () => {
    it("AC-3 — emits EDIT_GUARDIAN_PROFILE with only changed fields", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: "campus-1",
        fullName: "Carol Pham",
        occupation: null,
        userId: null,
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await useCase.execute("guardian-1", { occupation: "Engineer" }, actor);

      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);

      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("EDIT_GUARDIAN_PROFILE");
      expect(payload.targetType).toBe("guardian");
      expect(payload.targetId).toBe("guardian-1");
      expect(payload.campusId).toBe("campus-1");
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ occupation: null });
      expect(payload.afterValue).toEqual({ occupation: "Engineer" });
      expect(payload.beforeValue).not.toHaveProperty("fullName");
    });

    it("no-op edit does NOT emit an audit row", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        occupation: "Engineer",
        userId: null,
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await useCase.execute(
        "guardian-1",
        { occupation: "Engineer" }, // same value
        actor,
      );

      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });
  });

  describe("linked identity field restrictions", () => {
    it("rejects linked guardian email changes before DB writes", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: "campus-1",
        fullName: "Carol Pham",
        email: "carol@example.com",
        userId: "user-1",
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await expect(
        useCase.execute(
          "guardian-1",
          { email: "carol.new@example.com" },
          actor,
        ),
      ).rejects.toMatchObject({
        response: {
          code: "SHARED_IDENTITY_UPDATE_RESTRICTED",
        },
      });

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.updateGuardian).not.toHaveBeenCalled();
    });

    it("rejects linked guardian phone and fullName changes", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        fullName: "Carol Pham",
        phoneNumber: "+15550000001",
        userId: "user-1",
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await expect(
        useCase.execute(
          "guardian-1",
          { phoneNumber: "+15550000002", fullName: "Carol New" },
          actor,
        ),
      ).rejects.toMatchObject({
        response: {
          code: "SHARED_IDENTITY_UPDATE_RESTRICTED",
        },
      });

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("allows linked guardian non-identity field changes without identity sync", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        fullName: "Carol Pham",
        occupation: null,
        userId: "user-1",
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await useCase.execute("guardian-1", { occupation: "Engineer" }, actor);

      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("AC-4 — audit failure on DB-only path", () => {
    it("propagates recorder error and ran updateGuardian inside the UoW", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        fullName: "Carol Pham",
        occupation: null,
        userId: null,
      });
      guardianRepo.findById.mockResolvedValue(guardian);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute("guardian-1", { occupation: "Engineer" }, actor),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when guardian does not exist", async () => {
      guardianRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", { fullName: "X" }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
