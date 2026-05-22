import { ConflictException, NotFoundException } from "@nestjs/common";

import {
  UpdateStudentInput,
  UpdateStudentUseCase,
} from "./update-student.use-case";
import { StudentRepository } from "../../ports/student.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { createStudent, createMockStudentRepository } from "@/test-utils";

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

describe("UpdateStudentUseCase", () => {
  let useCase: UpdateStudentUseCase;
  let studentRepo: jest.Mocked<StudentRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    studentRepo = createMockStudentRepository();
    mockTx = {
      updateStudent: jest.fn().mockResolvedValue({ id: "student-1" }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    useCase = new UpdateStudentUseCase(studentRepo, unitOfWork);
  });

  describe("Scenario 3 — diff contains only changed fields", () => {
    it("PATCH phoneNumber only -> audit diff excludes fullName", async () => {
      const student = createStudent({
        id: "student-1",
        fullName: "Bob Tran",
        phoneNumber: "555-1111",
      });
      studentRepo.findById.mockResolvedValue(student);

      await useCase.execute("student-1", { phoneNumber: "555-2222" }, actor);

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("EDIT_STUDENT_PROFILE");
      expect(payload.targetType).toBe("student");
      expect(payload.targetId).toBe("student-1");
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({ actorName: "Alice Nguyen" });
      expect(payload.beforeValue).toEqual({ phoneNumber: "555-1111" });
      expect(payload.afterValue).toEqual({ phoneNumber: "555-2222" });
      expect(payload.beforeValue).not.toHaveProperty("fullName");
      expect(payload.afterValue).not.toHaveProperty("fullName");
    });
  });

  describe("AC-3 — happy path emits audit inside UoW", () => {
    it("calls updateStudent then recordAudit on the same tx", async () => {
      const student = createStudent({
        id: "student-1",
        campusId: "campus-1",
        fullName: "Bob Tran",
        email: "bob@example.com",
      });
      studentRepo.findById.mockResolvedValue(student);

      await useCase.execute(
        "student-1",
        { fullName: "Bob T.", email: "bob.t@example.com" },
        actor,
      );

      expect(mockTx.updateStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.updateStudent).toHaveBeenCalledWith(
        "student-1",
        expect.objectContaining({
          fullName: "Bob T.",
          email: "bob.t@example.com",
        }),
      );

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.beforeValue).toEqual({
        fullName: "Bob Tran",
        email: "bob@example.com",
      });
      expect(payload.afterValue).toEqual({
        fullName: "Bob T.",
        email: "bob.t@example.com",
      });
      expect(payload.campusId).toBe("campus-1");
    });
  });

  describe("no-op edit", () => {
    it("does NOT emit an audit row when nothing changed", async () => {
      const student = createStudent({
        id: "student-1",
        fullName: "Bob Tran",
      });
      studentRepo.findById.mockResolvedValue(student);

      await useCase.execute(
        "student-1",
        { fullName: "Bob Tran" }, // same value
        actor,
      );

      expect(mockTx.updateStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).not.toHaveBeenCalled();
    });
  });

  describe("AC-4 — audit failure rolls back", () => {
    it("propagates the recorder error after running the mutation inside the UoW", async () => {
      const student = createStudent({ id: "student-1", fullName: "Bob Tran" });
      studentRepo.findById.mockResolvedValue(student);
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute("student-1", { fullName: "New Name" }, actor),
      ).rejects.toThrow("audit fail");

      expect(mockTx.updateStudent).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      // The real PrismaUnitOfWork would now roll back the tx; verifying that
      // the audit emit ran INSIDE the UoW callback (and therefore inside the
      // tx) is enough at the unit-test layer. Full Prisma rollback coverage
      // lives in the integration sweep (@task-9cx0ob).
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when student does not exist", async () => {
      studentRepo.findById.mockResolvedValue(null);

      await expect(
        useCase.execute("missing", { fullName: "X" }, actor),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws ConflictException when email already exists in campus", async () => {
      const student = createStudent({
        id: "student-1",
        campusId: "campus-1",
        email: "bob@example.com",
      });
      studentRepo.findById.mockResolvedValue(student);
      studentRepo.findByEmailInCampus.mockResolvedValue(
        createStudent({ id: "other", email: "taken@example.com" }),
      );

      await expect(
        useCase.execute(
          "student-1",
          { email: "taken@example.com" } as UpdateStudentInput,
          actor,
        ),
      ).rejects.toThrow(ConflictException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
