import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";

import { AssignStaffToClassUseCase } from "./assign-staff-to-class.use-case";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassStaffErrorCode } from "../../class-staff-error-codes";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { User } from "@/domain/user-management/user.entity";

const ACTOR_ID = "actor-1";

function buildActor(): User {
  return User.reconstitute(
    {
      clerkUid: "user_assignstaff",
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

function createMockStaff(id: string, belongsToCampusId: string): Staff {
  return Staff.create(
    {
      campusId: belongsToCampusId,
      staffCode: "ST-2025-000001",
      fullName: "Test Staff",
      email: "test@example.com",
      phoneNumber: "+84912345678",
      address: null,
      dateOfBirth: null,
      gender: null,
    },
    id,
  );
}

describe("AssignStaffToClassUseCase", () => {
  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const staffId = "staff-1";

  let useCase: AssignStaffToClassUseCase;
  let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
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

    mockStaffRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<StaffRepository>;

    mockTx = {
      createClassStaff: jest.fn().mockResolvedValue({ classId, staffId }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TransactionContext>;

    unitOfWork = {
      run: jest.fn((task) => task(mockTx)),
    } as unknown as jest.Mocked<UnitOfWorkPort>;

    actor = buildActor();

    useCase = new AssignStaffToClassUseCase(
      mockClassStaffRepository,
      mockClassRepository,
      mockStaffRepository,
      unitOfWork,
    );
  });

  describe("Happy path", () => {
    it("creates the assignment and emits ASSIGN_STAFF_TO_CLASS inside the UoW", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockStaffRepository.findById.mockResolvedValue(
        createMockStaff(staffId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(null);

      const result = await useCase.execute(
        { campusId, classId, staffId, role: ClassStaffRole.ASSISTANT },
        actor,
      );

      expect(result).toBeInstanceOf(ClassStaff);
      expect(result.classId).toBe(classId);
      expect(result.staffId).toBe(staffId);
      expect(result.role).toBe(ClassStaffRole.ASSISTANT);

      // HOMEROOM uniqueness must be skipped for non-HOMEROOM roles to avoid
      // a redundant read on the hot path.
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).not.toHaveBeenCalled();

      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mockTx.createClassStaff).toHaveBeenCalledTimes(1);
      expect(mockTx.createClassStaff).toHaveBeenCalledWith(
        expect.objectContaining({
          classId,
          staffId,
          role: ClassStaffRole.ASSISTANT,
        }),
      );

      expect(mockTx.recordAudit).toHaveBeenCalledTimes(1);
      const payload = mockTx.recordAudit.mock.calls[0]![0];
      expect(payload.action).toBe("ASSIGN_STAFF_TO_CLASS");
      expect(payload.targetType).toBe("staff");
      expect(payload.targetId).toBe(staffId);
      expect(payload.campusId).toBe(campusId);
      expect(payload.actorId).toBe(ACTOR_ID);
      expect(payload.context).toEqual({
        actorName: "Alice Nguyen",
        classId,
        role: ClassStaffRole.ASSISTANT,
      });
    });

    it("checks HOMEROOM uniqueness when role is HOMEROOM and assignment proceeds", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockStaffRepository.findById.mockResolvedValue(
        createMockStaff(staffId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(null);
      mockClassStaffRepository.findHomeroomByClassId.mockResolvedValue(null);

      const result = await useCase.execute(
        { campusId, classId, staffId, role: ClassStaffRole.HOMEROOM },
        actor,
      );

      expect(result.role).toBe(ClassStaffRole.HOMEROOM);
      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).toHaveBeenCalledWith(classId);
      expect(mockTx.recordAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({ role: ClassStaffRole.HOMEROOM }),
        }),
      );
    });
  });

  describe("Class validation", () => {
    it("throws NotFoundException when class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          { campusId, classId, staffId, role: ClassStaffRole.ASSISTANT },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when class belongs to a different campus", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, otherCampusId),
      );

      await expect(
        useCase.execute(
          { campusId, classId, staffId, role: ClassStaffRole.ASSISTANT },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Staff validation", () => {
    it("throws NotFoundException when staff does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockStaffRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          { campusId, classId, staffId, role: ClassStaffRole.ASSISTANT },
          actor,
        ),
      ).rejects.toThrow(NotFoundException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("throws BadRequestException when staff belongs to a different campus", async () => {
      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockStaffRepository.findById.mockResolvedValue(
        createMockStaff(staffId, otherCampusId),
      );

      await expect(
        useCase.execute(
          { campusId, classId, staffId, role: ClassStaffRole.ASSISTANT },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("Duplicate (classId, staffId) rejection", () => {
    it("throws ConflictException with STAFF_ALREADY_ASSIGNED when the pair already exists", async () => {
      const existing = ClassStaff.create({
        classId,
        staffId,
        role: ClassStaffRole.ASSISTANT,
      });

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockStaffRepository.findById.mockResolvedValue(
        createMockStaff(staffId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(existing);

      await expect(
        useCase.execute(
          { campusId, classId, staffId, role: ClassStaffRole.ASSISTANT },
          actor,
        ),
      ).rejects.toThrow(
        new ConflictException(ClassStaffErrorCode.STAFF_ALREADY_ASSIGNED),
      );

      expect(
        mockClassStaffRepository.findHomeroomByClassId,
      ).not.toHaveBeenCalled();
      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });

  describe("HOMEROOM uniqueness invariant", () => {
    it("throws ConflictException with HOMEROOM_ALREADY_ASSIGNED when promoting a second HOMEROOM", async () => {
      const existingHomeroom = ClassStaff.create({
        classId,
        staffId: "other-staff",
        role: ClassStaffRole.HOMEROOM,
      });

      mockClassRepository.findById.mockResolvedValue(
        createMockClass(classId, campusId),
      );
      mockStaffRepository.findById.mockResolvedValue(
        createMockStaff(staffId, campusId),
      );
      mockClassStaffRepository.findByPair.mockResolvedValue(null);
      mockClassStaffRepository.findHomeroomByClassId.mockResolvedValue(
        existingHomeroom,
      );

      await expect(
        useCase.execute(
          { campusId, classId, staffId, role: ClassStaffRole.HOMEROOM },
          actor,
        ),
      ).rejects.toThrow(
        new ConflictException(ClassStaffErrorCode.HOMEROOM_ALREADY_ASSIGNED),
      );

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });
  });
});
