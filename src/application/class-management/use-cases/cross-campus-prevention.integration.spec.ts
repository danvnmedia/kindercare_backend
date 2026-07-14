/**
 * Cross-Campus Prevention Integration Tests
 * Tests that operations involving multiple entities properly reject cross-campus scenarios
 */

import { BadRequestException } from "@nestjs/common";
import { EnrollStudentUseCase } from "./enrollment/enroll-student.use-case";
import { AssignStaffToClassUseCase } from "./class-staff/assign-staff-to-class.use-case";
import { EnrollmentRepository } from "../ports/enrollment.repository";
import { ClassStaffRepository } from "../ports/class-staff.repository";
import { ClassRepository } from "../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../ports/school-year-enrollment.repository";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { StaffRepository } from "@/application/user-management/ports/staff.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";

// Most cross-campus cases short-circuit before the persist + audit-emit tx,
// but the same-campus happy-path test does reach it. Make the runner invoke
// its callback (with a stub tx) so the use case's await resolves, and the
// recorder no-op so the same-tx contract is satisfied without side effects.
const stubRunner = {
  run: jest.fn((task: (tx: unknown) => Promise<unknown>) => task({})),
} as unknown as TransactionRunnerPort;
const stubRecorder = {
  record: jest.fn().mockResolvedValue(undefined),
} as unknown as AuditEventRecorderPort;

// Cross-campus paths short-circuit at step 1b/2b, before the parent gate.
// All methods declared so `jest.Mocked<...>` is type-safe; no default returns
// needed because none of these tests reach the gate.
const createMockSyeRepository =
  (): jest.Mocked<SchoolYearEnrollmentRepository> =>
    ({
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findStructurallyOpenByStudentAndSchoolYear: jest.fn(),
      findCoveringDateByStudentAndSchoolYear: jest.fn(),
      findUpcomingByStudentAndSchoolYear: jest.fn(),
      findLatestByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      findStudentsBySchoolYear: jest.fn(),
      countChildEnrollments: jest.fn(),
      correctGradeLevel: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      withdrawWithChildren: jest.fn(),
    }) as jest.Mocked<SchoolYearEnrollmentRepository>;
import {
  createClass,
  createStaff,
  createStudent,
  DEFAULT_CAMPUS_ID_A,
  DEFAULT_CAMPUS_ID_B,
} from "@/test-utils";
import { User } from "@/domain/user-management/user.entity";

const stubActor = User.create({ clerkUid: "user_audit12345" });

describe("Cross-Campus Prevention Integration Tests", () => {
  const campusA = DEFAULT_CAMPUS_ID_A;
  const campusB = DEFAULT_CAMPUS_ID_B;

  describe("EnrollStudentUseCase - Cross-Campus Prevention", () => {
    let useCase: EnrollStudentUseCase;
    let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
    let mockClassRepository: jest.Mocked<ClassRepository>;
    let mockStudentRepository: jest.Mocked<StudentRepository>;
    let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;

    beforeEach(() => {
      mockEnrollmentRepository = {
        findById: jest.fn(),
        findByStudentClassDate: jest.fn(),
        findEffectiveByStudentIdAt: jest.fn(),
        findUpcomingByStudentId: jest.fn(),
        findStructurallyOpenByStudentId: jest.fn(),
        findOverlappingByStudentId: jest.fn(),
        findBySchoolYearEnrollmentId: jest.fn(),
        findByClassId: jest.fn(),
        findByStudentId: jest.fn(),
        findActiveByStudentId: jest.fn(),
        findByClassIdAndEffectiveStatus: jest.fn(),
        findActiveByClassIdOnDate: jest.fn(),
        findAllByStudentId: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        transferEnrollment: jest.fn(),
        saveMany: jest.fn(),
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
        findEligibleForClass: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        assignGuardians: jest.fn(),
        removeGuardians: jest.fn(),
        updateGuardianRelationship: jest.fn(),
        getStudentGuardians: jest.fn(),
      } as jest.Mocked<StudentRepository>;

      mockSyeRepository = createMockSyeRepository();

      useCase = new EnrollStudentUseCase(
        mockEnrollmentRepository,
        mockClassRepository,
        mockStudentRepository,
        mockSyeRepository,
        stubRunner,
        stubRecorder,
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
        useCase.execute(
          {
            campusId: campusB,
            classId: "class-1",
            studentId: "student-1",
            enrollmentDate: new Date(),
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            campusId: campusB,
            classId: "class-1",
            studentId: "student-1",
            enrollmentDate: new Date(),
          },
          stubActor,
        ),
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
        useCase.execute(
          {
            campusId: campusA, // Context is campus A
            classId: "class-1", // But class is in campus B
            studentId: "student-1",
            enrollmentDate: new Date(),
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            campusId: campusA,
            classId: "class-1",
            studentId: "student-1",
            enrollmentDate: new Date(),
          },
          stubActor,
        ),
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
      // Past the cross-campus checks, the parent-enrollment gate runs (D1/D3).
      // Stub an open parent with the matching grade so the happy path reaches save().
      const parent = SchoolYearEnrollment.create(
        {
          studentId: "student-1",
          campusId: campusA,
          schoolYearId: "school-year-1",
          gradeLevelId: "grade-level-1",
          enrollmentDate: new Date("2020-09-01T00:00:00.000Z"),
          exitDate: null,
          exitReason: null,
          note: null,
        },
        "sye-cross-campus-happy",
      );
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
        parent,
      );
      mockSyeRepository.findCoveringDateByStudentAndSchoolYear.mockResolvedValue(
        parent,
      );

      const result = await useCase.execute(
        {
          campusId: campusA,
          classId: "class-1",
          studentId: "student-1",
          enrollmentDate: new Date(),
        },
        stubActor,
      );

      expect(result).toBeDefined();
      expect(mockEnrollmentRepository.save).toHaveBeenCalled();
    });
  });

  describe("AssignStaffToClassUseCase - Cross-Campus Prevention", () => {
    let useCase: AssignStaffToClassUseCase;
    let mockClassStaffRepository: jest.Mocked<ClassStaffRepository>;
    let mockClassRepository: jest.Mocked<ClassRepository>;
    let mockStaffRepository: jest.Mocked<StaffRepository>;
    let unitOfWork: jest.Mocked<UnitOfWorkPort>;
    let mockTx: jest.Mocked<TransactionContext>;

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
        createClassStaff: jest
          .fn()
          .mockResolvedValue({ classId: "class-1", staffId: "staff-1" }),
        recordAudit: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<TransactionContext>;

      unitOfWork = {
        run: jest.fn((task) => task(mockTx)),
      } as unknown as jest.Mocked<UnitOfWorkPort>;

      useCase = new AssignStaffToClassUseCase(
        mockClassStaffRepository,
        mockClassRepository,
        mockStaffRepository,
        unitOfWork,
      );
    });

    it("should reject assigning campus A staff to campus B class", async () => {
      const classInCampusA = createClass({
        id: "class-1",
        campusId: campusA,
      });
      const staffInCampusB = createStaff({
        id: "staff-1",
        campusId: campusB,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusA);
      mockStaffRepository.findById.mockResolvedValue(staffInCampusB);

      await expect(
        useCase.execute(
          {
            campusId: campusA,
            classId: "class-1",
            staffId: "staff-1",
            role: ClassStaffRole.ASSISTANT,
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            campusId: campusA,
            classId: "class-1",
            staffId: "staff-1",
            role: ClassStaffRole.ASSISTANT,
          },
          stubActor,
        ),
      ).rejects.toThrow("Staff does not belong to this campus");

      expect(unitOfWork.run).not.toHaveBeenCalled();
    });

    it("should reject when class belongs to different campus than context", async () => {
      const classInCampusB = createClass({
        id: "class-1",
        campusId: campusB,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusB);

      await expect(
        useCase.execute(
          {
            campusId: campusA,
            classId: "class-1",
            staffId: "staff-1",
            role: ClassStaffRole.ASSISTANT,
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            campusId: campusA,
            classId: "class-1",
            staffId: "staff-1",
            role: ClassStaffRole.ASSISTANT,
          },
          stubActor,
        ),
      ).rejects.toThrow("Class does not belong to this campus");

      // Staff lookup should not happen
      expect(mockStaffRepository.findById).not.toHaveBeenCalled();
    });

    it("should allow assignment when class and staff are in the same campus", async () => {
      const classInCampusA = createClass({
        id: "class-1",
        campusId: campusA,
      });
      const staffInCampusA = createStaff({
        id: "staff-1",
        campusId: campusA,
      });

      mockClassRepository.findById.mockResolvedValue(classInCampusA);
      mockStaffRepository.findById.mockResolvedValue(staffInCampusA);
      mockClassStaffRepository.findByPair.mockResolvedValue(null);

      const result = await useCase.execute(
        {
          campusId: campusA,
          classId: "class-1",
          staffId: "staff-1",
          role: ClassStaffRole.ASSISTANT,
        },
        stubActor,
      );

      expect(result).toBeDefined();
      expect(unitOfWork.run).toHaveBeenCalledTimes(1);
      expect(mockTx.createClassStaff).toHaveBeenCalled();
    });
  });

  describe("Entity Validation Order", () => {
    it("should validate class campus before checking student campus (EnrollStudent)", async () => {
      const mockEnrollmentRepository = {
        findById: jest.fn(),
        findByStudentClassDate: jest.fn(),
        findEffectiveByStudentIdAt: jest.fn(),
        findUpcomingByStudentId: jest.fn(),
        findStructurallyOpenByStudentId: jest.fn(),
        findOverlappingByStudentId: jest.fn(),
        findBySchoolYearEnrollmentId: jest.fn(),
        findByClassId: jest.fn(),
        findByStudentId: jest.fn(),
        findActiveByStudentId: jest.fn(),
        findByClassIdAndEffectiveStatus: jest.fn(),
        findActiveByClassIdOnDate: jest.fn(),
        findAllByStudentId: jest.fn(),
        findAll: jest.fn(),
        save: jest.fn(),
        update: jest.fn(),
        transferEnrollment: jest.fn(),
        saveMany: jest.fn(),
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
        findEligibleForClass: jest.fn(),
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
        createMockSyeRepository(),
        stubRunner,
        stubRecorder,
      );

      // Class in campus B
      const classInCampusB = createClass({ id: "class-1", campusId: campusB });
      mockClassRepository.findById.mockResolvedValue(classInCampusB);

      // Request with campus A context
      await expect(
        useCase.execute(
          {
            campusId: campusA,
            classId: "class-1",
            studentId: "student-1",
            enrollmentDate: new Date(),
          },
          stubActor,
        ),
      ).rejects.toThrow("Class does not belong to this campus");

      // Student should never be looked up since class validation failed first
      expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    });
  });
});
