import { BadRequestException, NotFoundException } from "@nestjs/common";

import { RemoveStaffFromClassUseCase } from "./remove-staff-from-class.use-case";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { User } from "@/domain/user-management/user.entity";

const ACTOR_ID = "actor-1";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_removestaff",
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

function createMockClass(id: string, belongsToCampusId: string): Class {
  return Class.create(
    {
      name: "Test Class",
      campusId: belongsToCampusId,
      gradeLevelId: "grade-1",
      schoolYearId: "school-year-1",
    },
    id,
  );
}

function createMockAssignment(
  classId: string,
  staffId: string,
  role: ClassStaffRole,
): ClassStaff {
  return ClassStaff.create({ classId, staffId, role });
}

describe("RemoveStaffFromClassUseCase", () => {
  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const staffId = "staff-1";

  let useCase: RemoveStaffFromClassUseCase;
  let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let unitOfWork: jest.Mocked<UnitOfWorkPort>;
  let mockTx: jest.Mocked<TransactionContext>;
  let actor: User;

  beforeEach(() => {
    mockClassStaffRepository = {
      findByPair: jest.fn(),
      findHomeroomByClassId: jest.fn(),
      findByClassId: jest.fn(),
      findByStaffId: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteByClassId: jest.fn(),
      deleteByStaffId: jest.fn(),
    } as unknown as jest.Mocked<ClassStaffRepository>;

    mockClassRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ClassRepository>;

    mockTx = {
      deleteClassStaff: jest.fn().mockResolvedValue(undefined),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;

    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    actor = buildActor();

    useCase = new RemoveStaffFromClassUseCase(
      mockClassStaffRepository,
      mockClassRepository,
      unitOfWork,
    );
  });

  describe("Happy path", () => {
    it("deletes the row and emits REMOVE_STAFF_FROM_CLASS with role captured before deletion", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(
        createMockAssignment(classId, staffId, ClassStaffRole.HOMEROOM),
      );

      await useCase.execute({ campusId, classId, staffId }, actor);

      // Role must be read BEFORE the UoW block (AC-3): the lookup happens
      // before the run() call and the captured value flows into the audit
      // context where the row is already gone.
      const findByPairCallOrder =
        mockClassStaffRepository.findByPair.mock.invocationCallOrder[0]!;
      const runCallOrder = unitOfWork.run.mock.invocationCallOrder[0]!;
      expect(findByPairCallOrder).toBeLessThan(runCallOrder);

      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mockTx.deleteClassStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.deleteClassStaff).toHaveBeenCalledWith(classId, staffId);

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("REMOVE_STAFF_FROM_CLASS");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe(staffId);
      expect(payload.campusId).toBe(campusId);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        classId,
        role: ClassStaffRole.HOMEROOM,
      });
    });

    it("captures the role from the existing row regardless of value (ASSISTANT)", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(
        createMockAssignment(classId, staffId, ClassStaffRole.ASSISTANT),
      );

      await useCase.execute({ campusId, classId, staffId }, actor);

      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            role: ClassStaffRole.ASSISTANT,
          }),
        }),
      );
    });
  });

  describe("Class validation", () => {
    it("throws NotFoundException when class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({ campusId, classId, staffId }, actor),
      ).rejects.toThrow(NotFoundException);

      expect(mockClassStaffRepository.findByPair).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when class belongs to a different campus", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, otherCampusId),
      );

      await expect(
        useCase.execute({ campusId, classId, staffId }, actor),
      ).rejects.toThrow(BadRequestException);

      expect(mockClassStaffRepository.findByPair).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Assignment validation", () => {
    it("throws NotFoundException with STAFF_NOT_FOUND_IN_CLASS when assignment does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(null);

      await expect(
        useCase.execute({ campusId, classId, staffId }, actor),
      ).rejects.toThrow(
        new NotFoundException(ClassStaffErrorCode.STAFF_NOT_FOUND_IN_CLASS),
      );

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
