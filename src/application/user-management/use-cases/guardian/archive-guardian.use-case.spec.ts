import { NotFoundException } from "@nestjs/common";

import { ArchiveGuardianUseCase } from "./archive-guardian.use-case";
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
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

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

describe("ArchiveGuardianUseCase", () => {
  let useCase: ArchiveGuardianUseCase;
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
      updateUser: jest.fn().mockResolvedValue({ id: "user-1" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      lockIdentity: jest.fn().mockResolvedValue(undefined),
      unlockIdentity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdentityPort>;
    actor = buildActor();

    useCase = new ArchiveGuardianUseCase(
      guardianRepo,
      userRepo,
      unitOfWork,
      identityPort,
    );
  });

  describe("AC-3 — happy path emits ARCHIVE_GUARDIAN inside UoW", () => {
    it("locks Clerk, archives in DB, deactivates user, and records audit", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: CAMPUS_ID,
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

      await useCase.execute("guardian-1", CAMPUS_ID, actor);

      expect(identityPort.lockIdentity).toHaveBeenCalledTimes(1);
      expect(identityPort.lockIdentity).toHaveBeenCalledWith(
        "user_clerk1234567",
      );
      expect(mockTx.updateGuardian).toHaveBeenCalledWith(
        "guardian-1",
        expect.objectContaining({ isArchived: true }),
      );
      expect(mockTx.updateUser).toHaveBeenCalledWith("user-1", {
        isActive: false,
      });

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("ARCHIVE_GUARDIAN");
      expect(payload.targetType).toBe("guardian");
      expect(payload.targetId).toBe("guardian-1");
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ isArchived: false });
      expect(payload.afterValue).toEqual({ isArchived: true });
    });

    it("skips Clerk + updateUser when guardian has no User account", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: CAMPUS_ID,
        userId: null,
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await useCase.execute("guardian-1", CAMPUS_ID, actor);

      expect(identityPort.lockIdentity).not.toHaveBeenCalled();
      expect(mockTx.updateUser).not.toHaveBeenCalled();
      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit.mock.calls[0]![0].action).toBe(
        "ARCHIVE_GUARDIAN",
      );
    });
  });

  describe("AC-4 — rollback when recorder throws", () => {
    it("propagates the recorder error after running the mutation inside the UoW", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: CAMPUS_ID,
        userId: null,
      });
      guardianRepo.findById.mockResolvedValue(guardian);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute("guardian-1", CAMPUS_ID, actor),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when guardian does not exist", async () => {
      guardianRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", CAMPUS_ID, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when guardian belongs to a different campus", async () => {
      const guardian = createGuardian({
        id: "guardian-1",
        campusId: "22222222-2222-4222-a222-222222222222",
      });
      guardianRepo.findById.mockResolvedValue(guardian);

      await expect(
        useCase.execute("guardian-1", CAMPUS_ID, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
