/**
 * Cross-Campus Prevention Integration Tests
 * Tests that operations involving multiple entities properly reject cross-campus scenarios
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { EnrollStudentUseCase } from "./enrollment/enroll-student.use-case";
import { AssignStaffToClassUseCase } from "./class-staff/assign-staff-to-class.use-case";
import { EnrollmentRepository } from "../ports/enrollment.repository";
import { ClassStaffRepository } from "../ports/class-staff.repository";
import { ClassRepository } from "../ports/class.repository";
import { SubjectRepository } from "../ports/subject.repository";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import {
  createClass,
  createStaff,
  createStudent,
  createSubject,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";

describe("Cross-Campus Prevention Integration Tests", () => {
  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  describe("EnrollStudentUseCase - Cross-Campus Prevention", () => {
    let useCase: EnrollStudentUseCase;
    let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
    let mockClassRepository: jest.Mocked<ClassRepository>;
    let mockStudentRepository: jest.Mocked<StudentRepository>;

    beforeEach(() => {
      mockEnrollmentRepository = {
        findById: jest.fn(),
        findByStudentClassDate: jest.fn(),
        findByClassId: jest.fn(),
        findByStudentId: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteByStudentAndClass: jest.fn(),
      } as jest.Mocked<EnrollmentRepository>;

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

      mockStudentRepository = {
        findById: jest.fn(),
        findByEmail: jest.fn(),
        findByEmailInCampus: jest.fn(),
        findByPhoneNumber: jest.fn(),
        findByPhoneNumberInCampus: jest.fn(),
        findByStudentCodeInCampus: jest.fn(),
        findByCampusId: jest.fn(),
        findByIds: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        assignGuardians: jest.fn(),
        removeGuardians: jest.fn(),
        updateGuardianRelationship: jest.fn(),
        getStudentGuardians: jest.fn(),
      } as jest.Mocked<StudentRepository>;

      useCase = new EnrollStudentUseCase(
        mockEnrollmentRepository,
        mockClassRepository,
        mockStudentRepository,
      );
    });

    it("should reject enrolling campus A student in campus B class", async () => {
      // Class in campus B
      const classInCampusB = createClass({
        id: "class-1",
        campusId: campusB,
      });

      // Student in campus A
      const studentInCampusA = createStudent({
        id: "student-1",
        campusId: campusA,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusB);
      mockStudentRepository.findById.mockResolvedValue(studentInCampusA);

      // Request with campus B context (class's campus)
      await expect(
        useCase.execute({
          campusId: campusB,
          classId: "class-1",
          studentId: "student-1",
          enrollmentDate: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId: campusB,
          classId: "class-1",
          studentId: "student-1",
          enrollmentDate: new Date(),
        }),
      ).rejects.toThrow("Cannot enroll student from a different campus");

      // Verify enrollment was not saved
      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });

    it("should reject when class belongs to different campus than request context", async () => {
      // Class in campus B
      const classInCampusB = createClass({
        id: "class-1",
        campusId: campusB,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusB);

      // Request with campus A context
      await expect(
        useCase.execute({
          campusId: campusA, // Context is campus A
          classId: "class-1", // But class is in campus B
          studentId: "student-1",
          enrollmentDate: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          studentId: "student-1",
          enrollmentDate: new Date(),
        }),
      ).rejects.toThrow("Class does not belong to this campus");

      // Student lookup should not even happen
      expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    });

    it("should allow enrollment when student and class are in same campus", async () => {
      const classInCampusA = createClass({
        id: "class-1",
        campusId: campusA,
      });

      const studentInCampusA = createStudent({
        id: "student-1",
        campusId: campusA,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusA);
      mockStudentRepository.findById.mockResolvedValue(studentInCampusA);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);

      const result = await useCase.execute({
        campusId: campusA,
        classId: "class-1",
        studentId: "student-1",
        enrollmentDate: new Date(),
      });

      expect(result).toBeDefined();
      expect(mockEnrollmentRepository.save).toHaveBeenCalled();
    });
  });

  describe("AssignStaffToClassUseCase - Cross-Campus Prevention", () => {
    let useCase: AssignStaffToClassUseCase;
    let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
    let mockClassRepository: jest.Mocked<ClassRepository>;
    let mockStaffRepository: jest.Mocked<StaffRepository>;
    let mockSubjectRepository: jest.Mocked<SubjectRepository>;

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

    it("should reject assigning campus A staff to campus B class", async () => {
      // Class in campus A
      const classInCampusA = createClass({
        id: "class-1",
        campusId: campusA,
      });

      // Staff in campus B
      const staffInCampusB = createStaff({
        id: "staff-1",
        campusId: campusB,
      });

      // Subject in campus A
      const subjectInCampusA = createSubject({
        id: "subject-1",
        campusId: campusA,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusA);
      mockStaffRepository.findById.mockResolvedValue(staffInCampusB);
      mockSubjectRepository.findById.mockResolvedValue(subjectInCampusA);

      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          staffId: "staff-1",
          subjectId: "subject-1",
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          staffId: "staff-1",
          subjectId: "subject-1",
        }),
      ).rejects.toThrow("Staff does not belong to this campus");

      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });

    it("should reject when subject belongs to different campus", async () => {
      // All in campus A except subject
      const classInCampusA = createClass({
        id: "class-1",
        campusId: campusA,
      });

      const staffInCampusA = createStaff({
        id: "staff-1",
        campusId: campusA,
      });

      // Subject in campus B
      const subjectInCampusB = createSubject({
        id: "subject-1",
        campusId: campusB,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusA);
      mockStaffRepository.findById.mockResolvedValue(staffInCampusA);
      mockSubjectRepository.findById.mockResolvedValue(subjectInCampusB);

      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          staffId: "staff-1",
          subjectId: "subject-1",
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          staffId: "staff-1",
          subjectId: "subject-1",
        }),
      ).rejects.toThrow("Subject does not belong to this campus");

      expect(mockClassStaffRepository.save).not.toHaveBeenCalled();
    });

    it("should reject when class belongs to different campus than context", async () => {
      // Class in campus B
      const classInCampusB = createClass({
        id: "class-1",
        campusId: campusB,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusB);

      // Request with campus A context
      await expect(
        useCase.execute({
          campusId: campusA, // Context is campus A
          classId: "class-1", // But class is in campus B
          staffId: "staff-1",
          subjectId: "subject-1",
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          staffId: "staff-1",
          subjectId: "subject-1",
        }),
      ).rejects.toThrow("Class does not belong to this campus");

      // Staff and subject lookups should not happen
      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
      expect(mockSubjectRepository.findById).not.toHaveBeenCalled();
    });

    it("should allow assignment when all entities are in the same campus", async () => {
      const classInCampusA = createClass({
        id: "class-1",
        campusId: campusA,
      });

      const staffInCampusA = createStaff({
        id: "staff-1",
        campusId: campusA,
      });

      const subjectInCampusA = createSubject({
        id: "subject-1",
        campusId: campusA,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusA);
      mockStaffRepository.findById.mockResolvedValue(staffInCampusA);
      mockSubjectRepository.findById.mockResolvedValue(subjectInCampusA);
      mockClassStaffRepository.findByCompositeKey.mockResolvedValue(null);
      mockClassStaffRepository.save.mockImplementation(async (cs) => cs);

      const result = await useCase.execute({
        campusId: campusA,
        classId: "class-1",
        staffId: "staff-1",
        subjectId: "subject-1",
      });

      expect(result).toBeDefined();
      expect(mockClassStaffRepository.save).toHaveBeenCalled();
    });
  });

  describe("Entity Validation Order", () => {
    it("should validate class campus before checking student campus (EnrollStudent)", async () => {
      const mockEnrollmentRepository = {
        findById: jest.fn(),
        findByStudentClassDate: jest.fn(),
        findByClassId: jest.fn(),
        findByStudentId: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteByStudentAndClass: jest.fn(),
      } as jest.Mocked<EnrollmentRepository>;

      const mockClassRepository = {
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

      const mockStudentRepository = {
        findById: jest.fn(),
        findByEmail: jest.fn(),
        findByEmailInCampus: jest.fn(),
        findByPhoneNumber: jest.fn(),
        findByPhoneNumberInCampus: jest.fn(),
        findByStudentCodeInCampus: jest.fn(),
        findByCampusId: jest.fn(),
        findByIds: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        assignGuardians: jest.fn(),
        removeGuardians: jest.fn(),
        updateGuardianRelationship: jest.fn(),
        getStudentGuardians: jest.fn(),
      } as jest.Mocked<StudentRepository>;

      const useCase = new EnrollStudentUseCase(
        mockEnrollmentRepository,
        mockClassRepository,
        mockStudentRepository,
      );

      // Class in campus B
      const classInCampusB = createClass({ id: "class-1", campusId: campusB });
      mockClassRepository.findById.mockResolvedValue(classInCampusB);

      // Request with campus A context
      await expect(
        useCase.execute({
          campusId: campusA,
          classId: "class-1",
          studentId: "student-1",
          enrollmentDate: new Date(),
        }),
      ).rejects.toThrow("Class does not belong to this campus");

      // Student should never be looked up since class validation failed first
      expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    });
  });
});
