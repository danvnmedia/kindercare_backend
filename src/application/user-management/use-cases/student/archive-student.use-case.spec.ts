import { NotFoundException } from "@nestjs/common";

import { ArchiveStudentUseCase } from "./archive-student.use-case";
import { StudentRepository } from "../../ports/student.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Student } from "@/domain/user-management/entities/student.entity";
import { User } from "@/domain/user-management/user.entity";

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

function createMockStudent(
  overrides: Partial<{
    id: string;
    campusId: string;
    isArchived: boolean;
  }> = {},
): Student {
  return Student.create(
    {
      campusId: overrides.campusId ?? "campus-123",
      studentCode: "STU-001",
      fullName: "Test Student",
      email: "test@example.com",
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: null,
      isArchived: overrides.isArchived ?? false,
    },
    overrides.id ?? "student-123",
  );
}

describe("ArchiveStudentUseCase", () => {
  let useCase: ArchiveStudentUseCase;
  let studentRepo: jest.Mocked<StudentRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    studentRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StudentRepository>;
    mockTx = {
      updateStudent: jest.fn().mockResolvedValue({ id: "student-123" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    useCase = new ArchiveStudentUseCase(studentRepo, unitOfWork);
  });

  describe("AC-3 — happy path emits ARCHIVE_STUDENT inside UoW", () => {
    it("flips isArchived and records the audit row on the same tx", async () => {
      const student = createMockStudent({ campusId: "campus-123" });
      studentRepo.findById.mockResolvedValue(student);

      const result = await useCase.execute("student-123", undefined, actor);

      expect(result.isArchived).toBe(true);
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mockTx.updateStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.updateStudent).toHaveBeenCalledWith(
        "student-123",
        expect.objectContaining({ isArchived: true }),
      );

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("ARCHIVE_STUDENT");
      expect(payload.targetType).toBe("student");
      expect(payload.targetId).toBe("student-123");
      expect(payload.campusId).toBe("campus-123");
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ isArchived: false });
      expect(payload.afterValue).toEqual({ isArchived: true });
    });
  });

  describe("AC-4 — rollback when recorder throws", () => {
    it("propagates the recorder error after running updateStudent inside the UoW", async () => {
      const student = createMockStudent();
      studentRepo.findById.mockResolvedValue(student);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute("student-123", undefined, actor),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      // Real PrismaUnitOfWork rolls back the tx here. Full Prisma rollback
      // coverage lives in the integration sweep (@task-9cx0ob).
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when student does not exist", async () => {
      studentRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", undefined, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when student belongs to a different campus", async () => {
      const student = createMockStudent({ campusId: "campus-A" });
      studentRepo.findById.mockResolvedValue(student);

      await expect(
        useCase.execute("student-123", "campus-B", actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("archives when no campusId provided (skip validation)", async () => {
      const student = createMockStudent({ campusId: "campus-123" });
      studentRepo.findById.mockResolvedValue(student);

      const result = await useCase.execute("student-123", undefined, actor);

      expect(result.isArchived).toBe(true);
      expect(mockTx.updateStudent).toHaveBeenCalled();
      expect(mockTx.recordAudit).toHaveBeenCalled();
    });
  });
});
