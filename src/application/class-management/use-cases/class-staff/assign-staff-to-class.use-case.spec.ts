import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { AssignStaffToClassUseCase } from "./assign-staff-to-class.use-case";
import { ClassStaffRepository } from "../../ports/class-staff.repository";
import { ClassRepository } from "../../ports/class.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { SubjectRepository } from "../../ports/subject.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Subject } from "@/domain/class-management/entities/subject.entity";
import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";

describe("AssignStaffToClassUseCase", () => {
  let useCase: AssignStaffToClassUseCase;
  let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockSubjectRepository: jest.Mocked<SubjectRepository>;

  const campusId = "campus-1";
  const otherCampusId = "campus-2";
  const classId = "class-1";
  const staffId = "staff-1";
  const subjectId = "subject-1";

  // Mock entities
  const createMockClass = (id: string, belongsToCampusId: string): Class => {
    return Class.create(
      {
        name: "Test Class",
        campusId: belongsToCampusId,
        gradeLevelId: "grade-1",
        schoolYearId: "school-year-1",
      },
      id,
    );
  };

  const createMockStaff = (id: string, belongsToCampusId: string): Staff => {
    return Staff.create(
      {
        campusId: belongsToCampusId,
        fullName: "Test Staff",
        email: "test@example.com",
        phoneNumber: "+84912345678",
        address: null,
        dateOfBirth: null,
        gender: null,
        startDate: null,
      },
      id,
    );
  };

  const createMockSubject = (
    id: string,
    belongsToCampusId: string,
  ): Subject => {
    return Subject.create(
      {
        name: "Test Subject",
        campusId: belongsToCampusId,
      },
      id,
    );
  };

  beforeEach(() => {
    mockClassStaffRepository = {
      findByCompositeKey: jest.fn(),
      findByClassId: jest.fn(),
      findByStaffId: jest.fn(),
      findBySubjectId: jest.fn(),
      findByClassAndSubject: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      deleteByClassId: jest.fn(),
      deleteByStaffId: jest.fn(),
    } as jest.Mocked<ClassStaffRepository>;

    mockClassRepository = {
      findById: jest.fn(),
      findByNameInContextAndCampus: jest.fn(),
      findByCampusId: jest.fn(),
      findByGradeLevelId: jest.fn(),
      findBySchoolYearId: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<ClassRepository>;

    mockStaffRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByEmailInCampus: jest.fn(),
      findByPhoneNumber: jest.fn(),
      findByPhoneNumberInCampus: jest.fn(),
      findByUserId: jest.fn(),
      findByStaffTypeId: jest.fn(),
      findByCampusId: jest.fn(),
      findByIds: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<StaffRepository>;

    mockSubjectRepository = {
      findById: jest.fn(),
      findByNameAndCampus: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<SubjectRepository>;

    useCase = new AssignStaffToClassUseCase(
      mockClassStaffRepository,
      mockClassRepository,
      mockStaffRepository,
      mockSubjectRepository,
    );
  });

  describe("Success scenarios", () => {
    it("should assign staff to class successfully", async () => {
      const mockClass = createMockClass(classId, campusId);
      const mockStaff = createMockStaff(staffId, campusId);
      const mockSubject = createMockSubject(subjectId, campusId);

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStaffRepository.findById.mockResolvedValue(mockStaff);
      mockSubjectRepository.findById.mockResolvedValue(mockSubject);
      mockClassStaffRepository.findByCompositeKey.mockResolvedValue(null);
      mockClassStaffRepository.save.mockImplementation(
        async (classStaff) => classStaff,
      );

      const result = await useCase.execute({
        campusId,
        classId,
        staffId,
        subjectId,
      });

      expect(result).toBeInstanceOf(ClassStaff);
      expect(result.classId).toBe(classId);
      expect(result.staffId).toBe(staffId);
      expect(result.subjectId).toBe(subjectId);
      expect(mockClassRepository.findById).toHaveBeenCalledWith(classId);
      expect(mockStaffRepository.findById).toHaveBeenCalledWith(staffId);
      expect(mockSubjectRepository.findById).toHaveBeenCalledWith(subjectId);
      expect(mockClassStaffRepository.findByCompositeKey).toHaveBeenCalledWith(
        classId,
        staffId,
        subjectId,
      );
      expect(mockClassStaffRepository.save).toHaveBeenCalled();
    });
  });

  describe("Class validation", () => {
    it("should throw NotFoundException when class does not exist", async () => {
      mockClassRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(`Class with ID ${classId} not found`);

      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(mockSubjectRepository.findById).not.toHaveBeenCalled();
      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when class belongs to a different campus", async () => {
      const mockClass = createMockClass(classId, otherCampusId);
      mockClassRepository.findById.mockResolvedValue(mockClass);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow("Class does not belong to this campus");

      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(mockSubjectRepository.findById).not.toHaveBeenCalled();
      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("Staff validation", () => {
    it("should throw NotFoundException when staff does not exist", async () => {
      const mockClass = createMockClass(classId, campusId);
      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStaffRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(`Staff with ID ${staffId} not found`);

      expect(mockSubjectRepository.findById).not.toHaveBeenCalled();
      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when staff belongs to a different campus (cross-campus rejection)", async () => {
      const mockClass = createMockClass(classId, campusId);
      const mockStaff = createMockStaff(staffId, otherCampusId);

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStaffRepository.findById.mockResolvedValue(mockStaff);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow("Staff does not belong to this campus");

      expect(mockSubjectRepository.findById).not.toHaveBeenCalled();
      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("Subject validation", () => {
    it("should throw NotFoundException when subject does not exist", async () => {
      const mockClass = createMockClass(classId, campusId);
      const mockStaff = createMockStaff(staffId, campusId);

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStaffRepository.findById.mockResolvedValue(mockStaff);
      mockSubjectRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(`Subject with ID ${subjectId} not found`);

      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when subject belongs to a different campus (cross-campus rejection)", async () => {
      const mockClass = createMockClass(classId, campusId);
      const mockStaff = createMockStaff(staffId, campusId);
      const mockSubject = createMockSubject(subjectId, otherCampusId);

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStaffRepository.findById.mockResolvedValue(mockStaff);
      mockSubjectRepository.findById.mockResolvedValue(mockSubject);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow("Subject does not belong to this campus");

      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("Duplicate assignment validation", () => {
    it("should throw ConflictException when assignment already exists", async () => {
      const mockClass = createMockClass(classId, campusId);
      const mockStaff = createMockStaff(staffId, campusId);
      const mockSubject = createMockSubject(subjectId, campusId);
      const existingAssignment = ClassStaff.create({
        classId,
        staffId,
        subjectId,
      });

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStaffRepository.findById.mockResolvedValue(mockStaff);
      mockSubjectRepository.findById.mockResolvedValue(mockSubject);
      mockClassStaffRepository.findByCompositeKey.mockResolvedValue(
        existingAssignment,
      );

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute({
          campusId,
          classId,
          staffId,
          subjectId,
        }),
      ).rejects.toThrow(
        "Staff is already assigned to this class for this subject",
      );

      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });
  });
});
