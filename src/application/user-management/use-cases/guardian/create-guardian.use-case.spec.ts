import { BadRequestException, ConflictException } from "@nestjs/common";

import { CreateGuardianUseCase } from "./create-guardian.use-case";
import { GuardianRepository } from "../../ports/guardian.repository";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { createMockGuardianRepository } from "@/test-utils";

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

describe("CreateGuardianUseCase", () => {
  let useCase: CreateGuardianUseCase;
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let identityPort: jest.Mocked<IdentityPort>;
  let actor: User;

  const validInput = {
    campusId: CAMPUS_ID,
    fullName: "Carol Pham",
    email: "carol@example.com",
    phoneNumber: "+84900000001",
    gender: Gender.FEMALE,
  };

  beforeEach(() => {
    guardianRepo = createMockGuardianRepository();
    mockTx = {
      createUser: jest
        .fn()
        .mockResolvedValue({ id: "user-1", clerkUid: "user_new123" }),
      createGuardian: jest.fn().mockResolvedValue({ id: "guardian-1" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      provisionUser: jest.fn().mockResolvedValue({ clerkUid: "user_new123" }),
      deleteIdentity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdentityPort>;
    actor = buildActor();

    useCase = new CreateGuardianUseCase(guardianRepo, unitOfWork, identityPort);
  });

  describe("AC-3 — happy path emits CREATE_GUARDIAN inside UoW", () => {
    it("provisions Clerk, creates user + guardian, and records audit", async () => {
      const guardian = await useCase.execute(validInput, actor);

      expect(identityPort.provisionUser).toHaveBeenCalledTimes(1);
      expect(mockTx.createUser).toHaveBeenCalledWith({
        clerkUid: "user_new123",
        isActive: true,
      });
      expect(mockTx.createGuardian).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "Carol Pham",
          email: "carol@example.com",
          campusId: CAMPUS_ID,
          userId: "user-1",
        }),
      );

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("CREATE_GUARDIAN");
      expect(payload.targetType).toBe("guardian");
      expect(payload.targetId).toBe(guardian.id);
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        name: "Carol Pham",
        email: "carol@example.com",
        phoneNumber: "+84900000001",
      });
    });
  });

  describe("AC-4 — rollback compensates Clerk when audit throws", () => {
    it("propagates the recorder error and deletes the provisioned Clerk user", async () => {
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(mockTx.createGuardian).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_new123");
    });
  });

  describe("existing semantics preserved", () => {
    it("throws ConflictException when email already exists in campus", async () => {
      guardianRepo.findByEmailInCampus.mockResolvedValueOnce({
        id: "existing",
      } as never);

      await expect(useCase.execute(validInput, actor)).rejects.toThrow(
        ConflictException,
      );
      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("rejects under-18 guardians", async () => {
      const tooYoung = new Date();
      tooYoung.setFullYear(tooYoung.getFullYear() - 10);

      await expect(
        useCase.execute({ ...validInput, dateOfBirth: tooYoung }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
