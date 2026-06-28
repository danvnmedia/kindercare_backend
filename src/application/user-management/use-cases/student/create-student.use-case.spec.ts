import { BadRequestException, NotFoundException } from "@nestjs/common";

import { CreateStudentUseCase } from "./create-student.use-case";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";
import { StudentCodeGeneratorPort } from "@/application/ports/student-code-generator.port";
import { IdentityPort } from "@/application/ports/identity.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import {
  createMockStudentRepository,
  createMockGuardianRepository,
  createStudent,
  createGuardian,
} from "@/test-utils";

const ACTOR_ID = "actor-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const STUDENT_CODE = "STU-2026-000007";

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

describe("CreateStudentUseCase", () => {
  let useCase: CreateStudentUseCase;
  let studentRepo: jest.Mocked<StudentRepository>;
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let identityPort: jest.Mocked<IdentityPort>;
  let codeGenerator: jest.Mocked<StudentCodeGeneratorPort>;
  let actor: User;

  const baseInput = {
    campusId: CAMPUS_ID,
    fullName: "Eli Pham",
  };

  beforeEach(() => {
    studentRepo = createMockStudentRepository();
    guardianRepo = createMockGuardianRepository();
    mockTx = {
      createStudent: jest.fn().mockResolvedValue({ id: "student-1" }),
      createUser: jest
        .fn()
        .mockResolvedValue({ id: "user-1", clerkUid: "user_new123" }),
      assignGuardians: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    identityPort = {
      provisionUser: jest.fn().mockResolvedValue({ clerkUid: "user_new123" }),
      deleteIdentity: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdentityPort>;
    codeGenerator = {
      generateNextCode: jest.fn().mockResolvedValue(STUDENT_CODE),
    } as unknown as jest.Mocked<StudentCodeGeneratorPort>;
    actor = buildActor();

    // Re-read after create returns the persisted entity
    studentRepo.findById.mockImplementation(async () =>
      createStudent({ studentCode: STUDENT_CODE, campusId: CAMPUS_ID }),
    );

    useCase = new CreateStudentUseCase(
      studentRepo,
      guardianRepo,
      unitOfWork,
      identityPort,
      codeGenerator,
    );
  });

  describe("AC-3 — happy path emits CREATE_STUDENT inside UoW", () => {
    it("creates the student, skips Clerk + user, and records audit with name + code", async () => {
      await useCase.execute(baseInput, actor);

      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(mockTx.createUser).not.toHaveBeenCalled();
      expect(mockTx.createStudent).toHaveBeenCalledWith(
        expect.objectContaining({
          studentCode: STUDENT_CODE,
          fullName: "Eli Pham",
          campusId: CAMPUS_ID,
        }),
      );
      expect(mockTx.assignGuardians).not.toHaveBeenCalled();

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("CREATE_STUDENT");
      expect(payload.targetType).toBe("student");
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        name: "Eli Pham",
        code: STUDENT_CODE,
      });
    });

    it("provisions Clerk + creates user when createUserAccount=true", async () => {
      await useCase.execute(
        { ...baseInput, email: "eli@example.com", createUserAccount: true },
        actor,
      );

      expect(identityPort.provisionUser).toHaveBeenCalledTimes(1);
      expect(mockTx.createUser).toHaveBeenCalledWith({
        clerkUid: "user_new123",
        isActive: true,
      });
      expect(mockTx.createStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });

    it("assigns guardians when guardianIds provided", async () => {
      guardianRepo.findByIds.mockResolvedValue([
        createGuardian({ id: "g-1" }),
        createGuardian({ id: "g-2" }),
      ]);

      await useCase.execute(
        { ...baseInput, guardianIds: ["g-1", "g-2"] },
        actor,
      );

      expect(mockTx.assignGuardians).toHaveBeenCalledTimes(1);
      const [studentId, relations] = mockTx.assignGuardians.mock.calls[0]!;
      expect(typeof studentId).toBe("string");
      expect(relations).toEqual([
        { guardianId: "g-1", relationshipId: "GUARDIAN" },
        { guardianId: "g-2", relationshipId: "GUARDIAN" },
      ]);
    });
  });

  describe("AC-4 — rollback", () => {
    it("propagates the recorder error and compensates Clerk when createUserAccount=true", async () => {
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute(
          { ...baseInput, email: "eli@example.com", createUserAccount: true },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockTx.createStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      expect(identityPort.deleteIdentity).toHaveBeenCalledWith("user_new123");
    });

    it("propagates without Clerk compensation when createUserAccount=false", async () => {
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(useCase.execute(baseInput, actor)).rejects.toThrow(
        BadRequestException,
      );

      expect(identityPort.deleteIdentity).not.toHaveBeenCalled();
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when a guardian id is missing", async () => {
      guardianRepo.findByIds.mockResolvedValue([createGuardian({ id: "g-1" })]);

      await expect(
        useCase.execute({ ...baseInput, guardianIds: ["g-1", "g-2"] }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("rejects createUserAccount=true without email or phone", async () => {
      await expect(
        useCase.execute({ ...baseInput, createUserAccount: true }, actor),
      ).rejects.toThrow(BadRequestException);
      expect(identityPort.provisionUser).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
