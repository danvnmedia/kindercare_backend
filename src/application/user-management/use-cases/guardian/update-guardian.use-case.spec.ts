import { BadRequestException, NotFoundException } from "@nestjs/common";

import { UpdateGuardianUseCase } from "./update-guardian.use-case";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import {
  createGuardian,
  createMockGuardianRepository,
  createMockUserRepository,
} from "@/test-utils";

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
  let userRepo: jest.Mocked<UserRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let identityPort: jest.Mocked<IdentityPort>;
  let actor: User;

  beforeEach(() => {
    guardianRepo = createMockGuardianRepository();
    userRepo = createMockUserRepository();
    mockTx = {
      updateGuardian: jest.fn().mockResolvedValue({ id: "guardian-1" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      createUser: jest.fn(),
      updateUser: jest.fn().mockResolvedValue(undefined),
      deleteUser: jest.fn(),
    } as unknown as jest.Mocked<IdentityPort>;
    actor = buildActor();

    useCase = new UpdateGuardianUseCase(
      guardianRepo,
      userRepo,
      unitOfWork,
      identityPort,
    );
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

      expect(identityPort.updateUser).not.toHaveBeenCalled();
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

  describe("Clerk-saga path", () => {
    it("emits audit AFTER Clerk + updateGuardian succeed", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: "campus-1",
        fullName: "Carol Pham",
        email: "carol@example.com",
        userId: "user-1",
      });
      guardianRepo.findById.mockResolvedValue(guardian);
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          "user-1",
        ),
      );

      await useCase.execute(
        "guardian-1",
        { email: "carol.new@example.com" },
        actor,
      );

      expect(identityPort.updateUser).toHaveBeenCalledTimes(1);
      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({ email: "carol@example.com" });
      expect(payload.afterValue).toEqual({ email: "carol.new@example.com" });
    });

    it("AC-4 — recorder failure triggers Clerk revert", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        fullName: "Carol Pham",
        email: "carol@example.com",
        userId: "user-1",
      });
      guardianRepo.findById.mockResolvedValue(guardian);
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          "user-1",
        ),
      );
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute(
          "guardian-1",
          { email: "carol.new@example.com" },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Clerk updated once (initial), then reverted once (compensation) — 2 total
      expect(identityPort.updateUser).toHaveBeenCalledTimes(2);
      expect(identityPort.updateUser.mock.calls[1]![1]).toEqual({
        email: "carol@example.com",
      });
    });

    it("Clerk failure short-circuits before DB tx + audit", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        fullName: "Carol Pham",
        userId: "user-1",
      });
      guardianRepo.findById.mockResolvedValue(guardian);
      userRepo.findById.mockResolvedValue(
        User.reconstitute(
          {
            clerkUid: "user_clerk1234567",
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          "user-1",
        ),
      );
      identityPort.updateUser.mockRejectedValueOnce(new Error("clerk down"));

      await expect(
        useCase.execute(
          "guardian-1",
          { email: "carol.new@example.com" },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
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
