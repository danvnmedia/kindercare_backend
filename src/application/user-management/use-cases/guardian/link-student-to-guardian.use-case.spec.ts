import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

import { LinkStudentToGuardianUseCase } from "./link-student-to-guardian.use-case";
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
const REL_ID = "rel-father";

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

describe("LinkStudentToGuardianUseCase (guardian-side)", () => {
  let useCase: LinkStudentToGuardianUseCase;
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
      name: "Father",
      isArchived: false,
    } as never);
    studentRepo.getStudentGuardians.mockResolvedValue([]);

    useCase = new LinkStudentToGuardianUseCase(
      studentRepo,
      guardianRepo,
      relationshipRepo,
      unitOfWork,
    );
  });

  describe("AC-3 — happy path emits LINK_GUARDIAN_TO_STUDENT inside UoW", () => {
    it("targets the student and records both names + relationshipType", async () => {
      await useCase.execute(
        {
          campusId: CAMPUS_ID,
          guardianId: GUARDIAN_ID,
          studentId: STUDENT_ID,
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
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        studentId: STUDENT_ID,
        studentName: "Eli Pham",
        guardianId: GUARDIAN_ID,
        guardianName: "Carol Pham",
        relationshipId: REL_ID,
        relationshipType: "Father",
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
          guardianId: GUARDIAN_ID,
          studentId: STUDENT_ID,
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
    it("throws BadRequestException when relationship type is archived", async () => {
      relationshipRepo.findById.mockResolvedValueOnce({
        id: REL_ID,
        campusId: CAMPUS_ID,
        name: "Father",
        isArchived: true,
      } as never);

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            guardianId: GUARDIAN_ID,
            studentId: STUDENT_ID,
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
          relationshipName: "Father",
        },
      ]);

      await expect(
        useCase.execute(
        {
          campusId: CAMPUS_ID,
          guardianId: GUARDIAN_ID,
          studentId: STUDENT_ID,
          relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(ConflictException);
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException before mutation when guardian is in another campus", async () => {
      guardianRepo.findById.mockResolvedValueOnce(
        createGuardian({
          id: GUARDIAN_ID,
          campusId: "22222222-2222-4222-a222-222222222222",
          fullName: "Carol Pham",
        }),
      );

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            guardianId: GUARDIAN_ID,
            studentId: STUDENT_ID,
            relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(studentRepo.getStudentGuardians).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws NotFoundException before mutation when relationship type is in another campus", async () => {
      relationshipRepo.findById.mockResolvedValueOnce({
        id: REL_ID,
        campusId: "22222222-2222-4222-a222-222222222222",
        name: "Father",
        isArchived: false,
      } as never);

      await expect(
        useCase.execute(
          {
            campusId: CAMPUS_ID,
            guardianId: GUARDIAN_ID,
            studentId: STUDENT_ID,
            relationshipId: REL_ID,
          },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(guardianRepo.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
