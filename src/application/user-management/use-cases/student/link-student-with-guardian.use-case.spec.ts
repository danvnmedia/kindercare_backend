import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import { LinkStudentWithGuardianUseCase } from "./link-student-with-guardian.use-case";
import { StudentRepository } from "../../ports/student.repository";
import { GuardianRepository } from "../../ports/guardian.repository";
import { GuardianRelationshipTypeRepository } from "../../ports/guardian-relationship-type.repository";
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
const STUDENT_ID = "student-1";
const GUARDIAN_ID = "guardian-1";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const REL_ID = "rel-mother";

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

describe("LinkStudentWithGuardianUseCase", () => {
  let useCase: LinkStudentWithGuardianUseCase;
  let studentRepo: jest.Mocked<StudentRepository>;
  let guardianRepo: jest.Mocked<GuardianRepository>;
  let relationshipRepo: jest.Mocked<GuardianRelationshipTypeRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    studentRepo = createMockStudentRepository();
    guardianRepo = createMockGuardianRepository();
    relationshipRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<GuardianRelationshipTypeRepository>;
    mockTx = {
      assignGuardians: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;
    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;
    actor = buildActor();

    studentRepo.findById.mockResolvedValue(
      createStudent({
        id: STUDENT_ID,
        campusId: CAMPUS_ID,
        fullName: "Eli Pham",
      }),
    );
    guardianRepo.findById.mockResolvedValue(
      createGuardian({
        id: GUARDIAN_ID,
        campusId: CAMPUS_ID,
        fullName: "Carol Pham",
      }),
    );
    relationshipRepo.findById.mockResolvedValue({
      id: REL_ID,
      campusId: CAMPUS_ID,
      name: "Mother",
      isArchived: false,
    } as never);
    studentRepo.getStudentGuardians.mockResolvedValue([]);

    useCase = new LinkStudentWithGuardianUseCase(
      studentRepo,
      guardianRepo,
      relationshipRepo,
      unitOfWork,
    );
  });

  describe("AC-3 — happy path emits LINK_GUARDIAN_TO_STUDENT inside UoW", () => {
    it("inserts the link and records audit with both names + relationshipType", async () => {
      await useCase.execute(
        {
          campusId: CAMPUS_ID,
          studentId: STUDENT_ID,
          guardianId: GUARDIAN_ID,
          relationshipId: REL_ID,
        },
        actor,
      );

      expect(mockTx.assignGuardians).toHaveBeenCalledWith(STUDENT_ID, [
        { guardianId: GUARDIAN_ID, relationshipId: REL_ID },
      ]);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("LINK_GUARDIAN_TO_STUDENT");
      expect(payload.targetType).toBe("student");
      expect(payload.targetId).toBe(STUDENT_ID);
      expect(payload.campusId).toBe(CAMPUS_ID);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        studentId: STUDENT_ID,
        studentName: "Eli Pham",
        guardianId: GUARDIAN_ID,
        guardianName: "Carol Pham",
        relationshipId: REL_ID,
        relationshipType: "Mother",
      });
    });
  });

  describe("AC-4 — rollback when recorder throws", () => {
    it("propagates the error after running assignGuardians inside UoW", async () => {
      mockTx.recordAudit.mockRejectedValue(new Error("audit fail"));

      await expect(
        useCase.execute(
        {
          campusId: CAMPUS_ID,
          studentId: STUDENT_ID,
          guardianId: GUARDIAN_ID,
          relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow("audit fail");

      expect(mockTx.assignGuardians).toHaveBeenCalledTimes(1);
      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
    });
  });

  describe("existing semantics preserved", () => {
    it("throws NotFoundException when relationship type missing", async () => {
      relationshipRepo.findById.mockResolvedValueOnce(null);

      await expect(
        useCase.execute(
          {
            studentId: STUDENT_ID,
            guardianId: GUARDIAN_ID,
            relationshipId: REL_ID,
            campusId: CAMPUS_ID,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when relationship type is archived", async () => {
      relationshipRepo.findById.mockResolvedValueOnce({
        id: REL_ID,
        campusId: CAMPUS_ID,
        name: "Mother",
        isArchived: true,
      } as never);

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            studentId: STUDENT_ID,
            guardianId: GUARDIAN_ID,
            relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws ConflictException when link already exists", async () => {
      studentRepo.getStudentGuardians.mockResolvedValueOnce([
        {
          guardianId: GUARDIAN_ID,
          relationship: REL_ID,
          relationshipName: "Mother",
        },
      ]);

      await expect(
        useCase.execute(
        {
          campusId: CAMPUS_ID,
          studentId: STUDENT_ID,
          guardianId: GUARDIAN_ID,
          relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException before mutation when student is in another campus", async () => {
      studentRepo.findById.mockResolvedValueOnce(
        createStudent({
          id: STUDENT_ID,
          campusId: "22222222-2222-4222-a222-222222222222",
          fullName: "Eli Pham",
        }),
      );

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            studentId: STUDENT_ID,
            guardianId: GUARDIAN_ID,
            relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(guardianRepo.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException before mutation when relationship type is in another campus", async () => {
      relationshipRepo.findById.mockResolvedValueOnce({
        id: REL_ID,
        campusId: "22222222-2222-4222-a222-222222222222",
        name: "Mother",
        isArchived: false,
      } as never);

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            studentId: STUDENT_ID,
            guardianId: GUARDIAN_ID,
            relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(studentRepo.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
