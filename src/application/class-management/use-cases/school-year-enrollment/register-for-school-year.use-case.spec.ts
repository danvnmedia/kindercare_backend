import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { RegisterForSchoolYearUseCase } from "./register-for-school-year.use-case";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
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

describe("RegisterForSchoolYearUseCase", () => {
  let useCase: RegisterForSchoolYearUseCase;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;
  let mockStudentRepository: jest.Mocked<StudentRepository>;
  let mockSchoolYearRepository: jest.Mocked<SchoolYearRepository>;
  let mockGradeLevelRepository: jest.Mocked<GradeLevelRepository>;
  let runner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;

  const campusId = "campus-1";
  const differentCampusId = "campus-2";
  const studentId = "student-1";
  const schoolYearId = "school-year-1";
  const gradeLevelId = "grade-level-1";
  const enrollmentDate = new Date("2025-09-01T00:00:00.000Z");

  const createMockStudent = (overrides: { campusId?: string } = {}): Student =>
    Student.create(
      {
        campusId: overrides.campusId ?? campusId,
        studentCode: "STU001",
        fullName: "Nguyễn Văn A",
        email: "stu1@test.com",
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
      },
      studentId,
    );

  const createMockSchoolYear = (
    overrides: {
      campusId?: string;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): SchoolYear =>
    SchoolYear.create(
      {
        campusId: overrides.campusId ?? campusId,
        name: "SY 2025-2026",
        startDate: overrides.startDate ?? new Date("2025-08-01T00:00:00.000Z"),
        endDate: overrides.endDate ?? new Date("2026-07-31T00:00:00.000Z"),
      },
      schoolYearId,
    );

  const createMockGradeLevel = (
    overrides: { campusId?: string } = {},
  ): GradeLevel =>
    GradeLevel.create(
      {
        campusId: overrides.campusId ?? campusId,
        name: "Lớp Mầm",
        order: 1,
      },
      gradeLevelId,
    );

  beforeEach(() => {
    mockSyeRepository = {
      findById: jest.fn(),
      findOpenByStudentAndSchoolYear: jest.fn(),
      findAllByStudentId: jest.fn(),
      findAllByStudentIdWithChildCount: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      withdrawWithChildren: jest.fn(),
    } as jest.Mocked<SchoolYearEnrollmentRepository>;

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

    mockSchoolYearRepository = {
      findById: jest.fn(),
      findByNameAndCampus: jest.fn(),
      findNonArchived: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
    } as jest.Mocked<SchoolYearRepository>;

    mockGradeLevelRepository = {
      findById: jest.fn(),
      findByNameAndCampus: jest.fn(),
      findByOrderAndCampus: jest.fn(),
      findAll: jest.fn(),
      findNonArchived: jest.fn(),
      findAllPaginated: jest.fn(),
      findAllWithClasses: jest.fn(),
      findNonArchivedWithClasses: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      archive: jest.fn(),
      unarchive: jest.fn(),
      getMaxOrder: jest.fn(),
      reorder: jest.fn(),
    } as jest.Mocked<GradeLevelRepository>;

    runner = {
      run: jest.fn((task) => task(stubTx)),
    } as unknown as jest.Mocked<TransactionRunnerPort>;
    recorder = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<AuditEventRecorderPort>;

    useCase = new RegisterForSchoolYearUseCase(
      mockSyeRepository,
      mockStudentRepository,
      mockSchoolYearRepository,
      mockGradeLevelRepository,
      runner,
      recorder,
    );
  });

  // Convenience: wire all four lookups to a happy-path state.
  const arrangeHappyPath = () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockSchoolYearRepository.findById.mockResolvedValue(createMockSchoolYear());
    mockGradeLevelRepository.findById.mockResolvedValue(createMockGradeLevel());
    mockSyeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(null);
    mockSyeRepository.save.mockImplementation(async (e) => e);
  };

  it("creates the parent enrollment on the happy path", async () => {
    arrangeHappyPath();

    const result = await useCase.execute(
      {
        campusId,
        studentId,
        schoolYearId,
        gradeLevelId,
        enrollmentDate,
        note: "Late registration approved",
      },
      stubActor,
    );

    expect(result).toBeInstanceOf(SchoolYearEnrollment);
    expect(result.studentId).toBe(studentId);
    expect(result.campusId).toBe(campusId);
    expect(result.schoolYearId).toBe(schoolYearId);
    expect(result.gradeLevelId).toBe(gradeLevelId);
    expect(result.enrollmentDate).toEqual(enrollmentDate);
    expect(result.exitDate).toBeNull();
    expect(result.exitReason).toBeNull();
    expect(result.note).toBe("Late registration approved");

    expect(mockSyeRepository.save).toHaveBeenCalledTimes(1);
    expect(
      mockSyeRepository.findOpenByStudentAndSchoolYear,
    ).toHaveBeenCalledWith(studentId, schoolYearId);
  });

  it("creates without a note when none provided", async () => {
    arrangeHappyPath();

    const result = await useCase.execute(
      {
        campusId,
        studentId,
        schoolYearId,
        gradeLevelId,
        enrollmentDate,
      },
      stubActor,
    );

    expect(result.note).toBeNull();
  });

  it("throws 404 when student is missing", async () => {
    mockStudentRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockSchoolYearRepository.findById).not.toHaveBeenCalled();
    expect(mockSyeRepository.save).not.toHaveBeenCalled();
  });

  it("throws 404 when student belongs to a different campus (cross-campus hidden)", async () => {
    mockStudentRepository.findById.mockResolvedValue(
      createMockStudent({ campusId: differentCampusId }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(NotFoundException);

    expect(mockSchoolYearRepository.findById).not.toHaveBeenCalled();
  });

  it("throws 404 SCHOOL_YEAR_NOT_FOUND when school year missing", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockSchoolYearRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new NotFoundException(
        SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_NOT_FOUND,
      ),
    );
  });

  it("throws 404 SCHOOL_YEAR_NOT_FOUND when school year is cross-campus", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockSchoolYearRepository.findById.mockResolvedValue(
      createMockSchoolYear({ campusId: differentCampusId }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new NotFoundException(
        SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_NOT_FOUND,
      ),
    );
  });

  it("throws 404 GRADE_LEVEL_NOT_FOUND when grade level missing", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockSchoolYearRepository.findById.mockResolvedValue(createMockSchoolYear());
    mockGradeLevelRepository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new NotFoundException(
        SchoolYearEnrollmentErrorCode.GRADE_LEVEL_NOT_FOUND,
      ),
    );
  });

  it("throws 404 GRADE_LEVEL_NOT_FOUND when grade level is cross-campus", async () => {
    mockStudentRepository.findById.mockResolvedValue(createMockStudent());
    mockSchoolYearRepository.findById.mockResolvedValue(createMockSchoolYear());
    mockGradeLevelRepository.findById.mockResolvedValue(
      createMockGradeLevel({ campusId: differentCampusId }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new NotFoundException(
        SchoolYearEnrollmentErrorCode.GRADE_LEVEL_NOT_FOUND,
      ),
    );
  });

  it("throws 400 REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR when date is before SY.startDate", async () => {
    arrangeHappyPath();
    mockSchoolYearRepository.findById.mockResolvedValue(
      createMockSchoolYear({
        startDate: new Date("2025-08-01T00:00:00.000Z"),
        endDate: new Date("2026-07-31T00:00:00.000Z"),
      }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate: new Date("2025-07-01T00:00:00.000Z"),
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        SchoolYearEnrollmentErrorCode.REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR,
      ),
    );

    expect(
      mockSyeRepository.findOpenByStudentAndSchoolYear,
    ).not.toHaveBeenCalled();
  });

  it("throws 400 REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR when date is after SY.endDate", async () => {
    arrangeHappyPath();
    mockSchoolYearRepository.findById.mockResolvedValue(
      createMockSchoolYear({
        startDate: new Date("2025-08-01T00:00:00.000Z"),
        endDate: new Date("2026-07-31T00:00:00.000Z"),
      }),
    );

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate: new Date("2026-08-15T00:00:00.000Z"),
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        SchoolYearEnrollmentErrorCode.REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR,
      ),
    );
  });

  it("throws 409 SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS when an open parent exists for same (student, schoolYear)", async () => {
    arrangeHappyPath();
    const existing = SchoolYearEnrollment.create(
      {
        studentId,
        campusId,
        schoolYearId,
        gradeLevelId,
        enrollmentDate: new Date("2025-08-15T00:00:00.000Z"),
        exitDate: null,
        exitReason: null,
        note: null,
      },
      "sye-existing",
    );
    mockSyeRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
      existing,
    );

    await expect(
      useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      ),
    ).rejects.toThrow(
      new ConflictException(
        SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS,
      ),
    );

    expect(mockSyeRepository.save).not.toHaveBeenCalled();
  });

  // Spec Scenario 6: an open parent in a DIFFERENT school year does NOT block
  // registration for the new school year. The use case scopes the open-check
  // by (studentId, schoolYearId) so cross-year pre-registration is allowed.
  it("allows registration for a different school year even with an open parent in another year", async () => {
    arrangeHappyPath();
    // No open parent in target SY → success path. The other-year open parent
    // is implicitly out of scope because the repository call filters by
    // schoolYearId; no need to mock anything extra.
    const result = await useCase.execute(
      {
        campusId,
        studentId,
        schoolYearId,
        gradeLevelId,
        enrollmentDate,
      },
      stubActor,
    );

    expect(result).toBeInstanceOf(SchoolYearEnrollment);
    expect(
      mockSyeRepository.findOpenByStudentAndSchoolYear,
    ).toHaveBeenCalledWith(studentId, schoolYearId);
    expect(mockSyeRepository.save).toHaveBeenCalledTimes(1);
  });

  describe("audit-log emission (admin-audit-log AC-3 / AC-7)", () => {
    it("emits REGISTER_FOR_SCHOOL_YEAR audit row inside the same tx", async () => {
      arrangeHappyPath();

      await useCase.execute(
        {
          campusId,
          studentId,
          schoolYearId,
          gradeLevelId,
          enrollmentDate,
        },
        stubActor,
      );

      expect(recorder.record).toHaveBeenCalledTimes(1);
      const [auditInput, txArg] = recorder.record.mock.calls[0];
      expect(auditInput).toMatchObject({
        actorId: stubActor.id,
        action: "REGISTER_FOR_SCHOOL_YEAR",
        targetType: "student",
        targetId: studentId,
        campusId,
      });
      expect(auditInput.context).toMatchObject({
        actorName: "Alice Nguyen",
        schoolYearId,
        schoolYearName: "SY 2025-2026",
        gradeLevelId,
        gradeLevelName: "Lớp Mầm",
        enrollmentDate: enrollmentDate.toISOString(),
      });
      expect(txArg).toBe(stubTx);
      expect(mockSyeRepository.save).toHaveBeenCalledWith(
        expect.any(Object),
        stubTx,
      );
    });
  });

  describe("rollback on recorder failure (admin-audit-log AC-4 / Scenario 2)", () => {
    it("propagates the recorder error so the outer tx rolls back the registration", async () => {
      arrangeHappyPath();
      const auditFailure = new Error("audit failure");
      recorder.record.mockRejectedValue(auditFailure);

      await expect(
        useCase.execute(
          {
            campusId,
            studentId,
            schoolYearId,
            gradeLevelId,
            enrollmentDate,
          },
          stubActor,
        ),
      ).rejects.toBe(auditFailure);

      // save WAS called — inside the tx that ultimately threw. A real DB
      // would roll it back when the audit error bubbles out of `runner.run`.
      expect(mockSyeRepository.save).toHaveBeenCalledTimes(1);
    });
  });
});
