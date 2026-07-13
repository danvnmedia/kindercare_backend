import {
  ConflictException,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { EnrollStudentUseCase } from "./enroll-student.use-case";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { User } from "@/domain/user-management/user.entity";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

const stubActor = User.reconstitute(
  {
    clerkUid: "user_audit12345",
    isActive: true,
    profile: {
      type: "staff",
      id: "actor-1",
      fullName: "Alice Nguyen",
      email: null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  "actor-1",
);

const stubTx = {} as unknown as AppTransactionClient;

describe("EnrollStudentUseCase", () => {
  let useCase: EnrollStudentUseCase;
  let mockEnrollmentRepository: jest.Mocked<EnrollmentRepository>;
  let mockClassRepository: jest.Mocked<ClassRepository>;
  let mockStudentRepository: jest.Mocked<StudentRepository>;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;
  let runner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;

  const campusId = "campus-1";
  const differentCampusId = "campus-2";
  const classId = "class-1";
  const studentId = "student-1";
  const enrollmentDate = new Date("2024-01-15");
  const schoolYearId = "school-year-1";
  const gradeLevelId = "grade-level-1";
  const parentId = "sye-parent-1";

  // Helper to create a mock Class entity. Default SchoolYear range is wide
  // (2020-01-01 → 2030-12-31) so existing tests using `2024-01-15` enrollmentDate
  // continue to pass. Override `schoolYearRange` for date-bounds tests.
  const createMockClass = (
    overrides: {
      campusId?: string;
      schoolYearRange?: { startDate: Date; endDate: Date };
    } = {},
  ): Class => {
    const ownerCampusId = overrides.campusId ?? campusId;
    const range = overrides.schoolYearRange ?? {
      startDate: new Date("2020-01-01T00:00:00.000Z"),
      endDate: new Date("2030-12-31T00:00:00.000Z"),
    };
    const schoolYear = SchoolYear.create(
      {
        campusId: ownerCampusId,
        name: "Test School Year",
        startDate: range.startDate,
        endDate: range.endDate,
      },
      "school-year-1",
    );
    return Class.create(
      {
        name: "Test Class",
        campusId: ownerCampusId,
        gradeLevelId: "grade-level-1",
        schoolYearId: "school-year-1",
        description: null,
        schoolYear,
      },
      classId,
    );
  };

  // Helper to create a mock Student entity
  const createMockStudent = (
    overrides: { campusId?: string } = {},
  ): Student => {
    return Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: "STU001",
        fullName: "Test Student",
        email: "student@test.com",
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      studentId,
    );
  };

  // Helper to create a mock parent SchoolYearEnrollment matching the class's
  // schoolYearId by default. Override `gradeLevelId` for mismatch tests.
  const createMockParent = (
    overrides: { gradeLevelId?: string } = {},
  ): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? gradeLevelId,
        enrollmentDate: new Date("2023-09-01T00:00:00.000Z"),
        exitDate: null,
        exitReason: null,
        note: null,
      },
      parentId,
    );

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

    mockSyeRepository = {
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
    } as jest.Mocked<SchoolYearEnrollmentRepository>;

    runner = {
      run: jest.fn((task) => task(stubTx)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;

    useCase = new EnrollStudentUseCase(
      mockEnrollmentRepository,
      mockClassRepository,
      mockStudentRepository,
      mockSyeRepository,
      runner,
      recorder,
    );

    // Default: no active enrollment. Individual tests override for AC-21.
    mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
    mockEnrollmentRepository.findOverlappingByStudentId.mockImplementation(
      (studentId) => mockEnrollmentRepository.findActiveByStudentId(studentId),
    );
    // Default: open parent exists with matching grade level. Individual tests
    // override for the parent-gate paths (AC-16 / AC-17).
    mockSyeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
      createMockParent(),
    );
    mockSyeRepository.findCoveringDateByStudentAndSchoolYear.mockImplementation(
      (studentId, schoolYearId) =>
        mockSyeRepository.findOpenByStudentAndSchoolYear(
          studentId,
          schoolYearId,
        ),
    );
  });

  it("should enroll a student successfully", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    mockEnrollmentRepository.save.mockImplementation(
      async (enrollment) => enrollment,
    );

    const result = await useCase.execute(
      {
        campusId,
        classId,
        studentId,
        enrollmentDate,
        note: "Test enrollment note",
      },
      stubActor,
    );

    expect(result).toBeInstanceOf(Enrollment);
    expect(result.classId).toBe(classId);
    expect(result.studentId).toBe(studentId);
    expect(result.enrollmentDate).toEqual(enrollmentDate);
    expect(result.note).toBe("Test enrollment note");
    // AC-5: parent FK threaded onto the persisted child row.
    expect(result.schoolYearEnrollmentId).toBe(parentId);

    expect(mockClassRepository.findById).toHaveBeenCalledWith(classId);
    expect(mockStudentRepository.findById).toHaveBeenCalledWith(studentId);
    expect(
      mockEnrollmentRepository.findOverlappingByStudentId,
    ).toHaveBeenCalledWith(studentId, enrollmentDate);
    expect(
      mockSyeRepository.findCoveringDateByStudentAndSchoolYear,
    ).toHaveBeenCalledWith(studentId, schoolYearId, enrollmentDate);
    expect(mockEnrollmentRepository.save).toHaveBeenCalled();
  });

  it("should enroll a student without a note", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    mockEnrollmentRepository.save.mockImplementation(
      async (enrollment) => enrollment,
    );

    const result = await useCase.execute(
      {
        campusId,
        classId,
        studentId,
        enrollmentDate,
      },
      stubActor,
    );

    expect(result.note).toBeNull();
  });

  it("should throw NotFoundException when class does not exist", async () => {
    mockClassRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(NotFoundException);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(`Class with ID ${classId} not found`);

    expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException when class belongs to a different campus", async () => {
    const mockClass = createMockClass({ campusId: differentCampusId });

    mockClassRepository.findById.mockResolvedValue(mockClass);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow("Class does not belong to this campus");

    expect(mockStudentRepository.findById).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw NotFoundException when student does not exist", async () => {
    const mockClass = createMockClass();

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(NotFoundException);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(`Student with ID ${studentId} not found`);

    expect(
      mockEnrollmentRepository.findByStudentClassDate,
    ).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException when student belongs to a different campus (cross-campus rejection)", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent({ campusId: differentCampusId });

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(
      "Cannot enroll student from a different campus into this class",
    );

    expect(
      mockEnrollmentRepository.findByStudentClassDate,
    ).not.toHaveBeenCalled();
    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("should throw ConflictException when duplicate enrollment exists on same date", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();
    const existingEnrollment = Enrollment.create({
      classId,
      studentId,
      schoolYearEnrollmentId: "sye-test",
      enrollmentDate,
      note: null,
    });

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findOverlappingByStudentId.mockResolvedValue(
      existingEnrollment,
    );

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(ConflictException);

    await expect(
      useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow("ENROLLMENT_PERIOD_OVERLAP");

    expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("maps a database overlap race to a stable 409 with nullable conflict context", async () => {
    mockClassRepository.findById.mockResolvedValue(createMockClass());
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockEnrollmentRepository.save.mockRejectedValue({
      code: "P2002",
      message: "Unique constraint failed",
      meta: {
        modelName: "Enrollment",
        target: "idx_enrollment_unique_uncancelled_start",
      },
    });

    const promise = useCase.execute(
      { campusId, classId, studentId, enrollmentDate },
      stubActor,
    );

    await expect(promise).rejects.toBeInstanceOf(ConflictException);
    await expect(promise).rejects.toMatchObject({
      response: {
        code: "ENROLLMENT_PERIOD_OVERLAP",
        message: "ENROLLMENT_PERIOD_OVERLAP",
        conflictingEnrollment: null,
      },
    });
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("should allow enrollment on different dates for same student and class", async () => {
    const mockClass = createMockClass();
    const mockStudent = createMockStudent();
    const newEnrollmentDate = new Date("2024-02-01");

    mockClassRepository.findById.mockResolvedValue(mockClass);
    mockStudentRepository.findById.mockResolvedValue(mockStudent);
    mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
    mockEnrollmentRepository.save.mockImplementation(
      async (enrollment) => enrollment,
    );

    const result = await useCase.execute(
      {
        campusId,
        classId,
        studentId,
        enrollmentDate: newEnrollmentDate,
      },
      stubActor,
    );

    expect(result.enrollmentDate).toEqual(newEnrollmentDate);
    expect(mockEnrollmentRepository.save).toHaveBeenCalled();
  });

  describe("inclusive enrollment-period overlap", () => {
    it("throws ConflictException ENROLLMENT_PERIOD_OVERLAP when a proposed period overlaps another class", async () => {
      const mockClass = createMockClass();
      const mockStudent = createMockStudent();
      const activeElsewhere = Enrollment.create({
        classId: "other-class",
        studentId,
        schoolYearEnrollmentId: "sye-other",
        enrollmentDate: new Date("2024-01-01"),
        endDate: null,
        exitReason: null,
        note: null,
      });

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        activeElsewhere,
      );

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow("ENROLLMENT_PERIOD_OVERLAP");

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("AC-22 / Scenario 4: re-enroll after withdraw", () => {
    it("succeeds when student has no active enrollment (post-withdraw regression)", async () => {
      const mockClass = createMockClass();
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);

      const result = await useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      );

      expect(result).toBeInstanceOf(Enrollment);
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).toHaveBeenCalledWith(studentId);
      expect(mockEnrollmentRepository.save).toHaveBeenCalled();
    });
  });

  describe("AC-27 / Scenario 10: enrollmentDate outside school year", () => {
    it("rejects enrollmentDate before schoolYear.startDate with ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR", async () => {
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).not.toHaveBeenCalled();
    });

    it("rejects enrollmentDate after schoolYear.endDate with ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR", async () => {
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate: new Date("2025-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });

    it("accepts enrollmentDate exactly on schoolYear.startDate (inclusive boundary)", async () => {
      const startDate = new Date("2024-09-01T00:00:00.000Z");
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate,
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(null);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);

      const result = await useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate: startDate,
        },
        stubActor,
      );

      expect(result).toBeInstanceOf(Enrollment);
      expect(mockEnrollmentRepository.save).toHaveBeenCalled();
    });
  });

  describe("AC-16 / Scenario 2: parent-enrollment gate (NO_SCHOOL_YEAR_ENROLLMENT)", () => {
    it("throws ConflictException NO_SCHOOL_YEAR_ENROLLMENT when no open parent exists for the class's school year", async () => {
      const mockClass = createMockClass();
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(null);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow(
        SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
      );

      expect(
        mockSyeRepository.findOpenByStudentAndSchoolYear,
      ).toHaveBeenCalledWith(studentId, schoolYearId);
      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("AC-17 / Scenario 3: parent-enrollment gate (GRADE_LEVEL_MISMATCH)", () => {
    it("throws ConflictException GRADE_LEVEL_MISMATCH when open parent's grade differs from class's grade", async () => {
      const mockClass = createMockClass();
      const mockStudent = createMockStudent();

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockSyeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
        createMockParent({ gradeLevelId: "grade-level-OTHER" }),
      );

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow(ConflictException);

      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow(SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH);

      expect(mockEnrollmentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("validation order", () => {
    it("checks school-year bounds before active-anywhere when both would fail", async () => {
      const mockClass = createMockClass({
        schoolYearRange: {
          startDate: new Date("2024-09-01T00:00:00.000Z"),
          endDate: new Date("2025-06-30T00:00:00.000Z"),
        },
      });
      const mockStudent = createMockStudent();
      const activeElsewhere = Enrollment.create({
        classId: "other-class",
        studentId,
        schoolYearEnrollmentId: "sye-other",
        enrollmentDate: new Date("2024-10-01"),
        endDate: null,
        exitReason: null,
        note: null,
      });

      mockClassRepository.findById.mockResolvedValue(mockClass);
      mockStudentRepository.findById.mockResolvedValue(mockStudent);
      mockEnrollmentRepository.findActiveByStudentId.mockResolvedValue(
        activeElsewhere,
      );

      // Both would fail: enrollmentDate is out-of-range AND student has active enrollment.
      // Spec validation order: school-year bounds fires first (400, not 409).
      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate: new Date("2024-08-15T00:00:00.000Z"),
          },
          stubActor,
        ),
      ).rejects.toThrow("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");

      // findActiveByStudentId should not have been consulted yet.
      expect(
        mockEnrollmentRepository.findActiveByStudentId,
      ).not.toHaveBeenCalled();
    });
  });

  describe("audit-log emission (admin-audit-log AC-3 / AC-7)", () => {
    it("emits ENROLL_STUDENT_TO_CLASS audit row inside the same tx", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockResolvedValue(createMockStudent());
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);

      await useCase.execute(
        {
          campusId,
          classId,
          studentId,
          enrollmentDate,
        },
        stubActor,
      );

      expect(recorder.record).toHaveBeenCalledTimes(1);
      const [auditInput, txArg] = recorder.record.mock.calls[0];
      expect(auditInput).toMatchObject({
        actorId: stubActor.id,
        action: "ENROLL_STUDENT_TO_CLASS",
        targetType: "student",
        targetId: studentId,
        campusId,
      });
      expect(auditInput.context).toMatchObject({
        actorName: "Alice Nguyen",
        classId,
        className: "Test Class",
        enrollmentDate: enrollmentDate.toISOString(),
      });
      expect(txArg).toBe(stubTx);
      // save was called with the tx as the second arg.
      expect(mockEnrollmentRepository.save).toHaveBeenCalledWith(
        expect.any(Object),
        stubTx,
      );
    });
  });

  describe("rollback on recorder failure (admin-audit-log AC-4 / Scenario 2)", () => {
    it("propagates the recorder error so the outer tx rolls back the enrollment", async () => {
      mockClassRepository.findById.mockResolvedValue(createMockClass());
      mockStudentRepository.findById.mockResolvedValue(createMockStudent());
      mockEnrollmentRepository.findByStudentClassDate.mockResolvedValue(null);
      mockEnrollmentRepository.save.mockImplementation(async (e) => e);
      const auditFailure = new Error("audit failure");
      recorder.record.mockRejectedValue(auditFailure);

      // The use case wraps its body in a try/catch that re-throws BadRequest
      // for unknown errors. Assert the underlying message survives.
      await expect(
        useCase.execute(
          {
            campusId,
            classId,
            studentId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toThrow("audit failure");

      // save WAS called — inside the tx that ultimately threw. A real DB
      // would roll it back when the audit error bubbles out.
      expect(mockEnrollmentRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
