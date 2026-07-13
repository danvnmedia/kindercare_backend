import { ConflictException, NotFoundException } from "@nestjs/common";
import { CorrectSchoolYearEnrollmentGradeUseCase } from "./correct-school-year-enrollment-grade.use-case";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import {
  SchoolYearEnrollmentErrorCode,
  SchoolYearEnrollmentGradeCorrectionAction,
} from "../../school-year-enrollment-error-codes";
import { User } from "@/domain/user-management/user.entity";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

const stubActor = User.reconstitute(
  {
    clerkUid: "user_grade_corrector",
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

describe("CorrectSchoolYearEnrollmentGradeUseCase", () => {
  let useCase: CorrectSchoolYearEnrollmentGradeUseCase;
  let mockSyeRepository: jest.Mocked<SchoolYearEnrollmentRepository>;
  let mockGradeLevelRepository: jest.Mocked<GradeLevelRepository>;
  let runner: jest.Mocked<TransactionRunnerPort>;
  let recorder: jest.Mocked<AuditEventRecorderPort>;

  const campusId = "campus-1";
  const differentCampusId = "campus-2";
  const studentId = "student-1";
  const parentId = "sye-1";
  const schoolYearId = "school-year-1";
  const oldGradeLevelId = "grade-old";
  const targetGradeLevelId = "grade-target";
  const enrollmentDate = new Date("2025-09-01T00:00:00.000Z");

  const createGradeLevel = (
    id: string,
    overrides: { campusId?: string; name?: string; order?: number } = {},
  ): GradeLevel =>
    GradeLevel.create(
      {
        campusId: overrides.campusId ?? campusId,
        name: overrides.name ?? (id === oldGradeLevelId ? "Mam" : "Choi"),
        order: overrides.order ?? (id === oldGradeLevelId ? 1 : 2),
      },
      id,
    );

  const createSchoolYear = (): SchoolYear =>
    SchoolYear.create(
      {
        campusId,
        name: "SY 2025-2026",
        startDate: new Date("2025-08-01T00:00:00.000Z"),
        endDate: new Date("2026-07-31T00:00:00.000Z"),
      },
      schoolYearId,
    );

  const createParent = (
    overrides: {
      campusId?: string;
      studentId?: string;
      gradeLevelId?: string;
      gradeLevel?: GradeLevel;
      exitDate?: Date | null;
      exitReason?: ExitReason | null;
    } = {},
  ): SchoolYearEnrollment =>
    SchoolYearEnrollment.create(
      {
        studentId: overrides.studentId ?? studentId,
        campusId: overrides.campusId ?? campusId,
        schoolYearId,
        gradeLevelId: overrides.gradeLevelId ?? oldGradeLevelId,
        enrollmentDate,
        exitDate: overrides.exitDate ?? null,
        exitReason: overrides.exitReason ?? null,
        note: null,
        schoolYear: createSchoolYear(),
        gradeLevel:
          overrides.gradeLevel ??
          createGradeLevel(overrides.gradeLevelId ?? oldGradeLevelId),
      },
      parentId,
    );

  const arrangeHappyPath = () => {
    mockSyeRepository.findById.mockResolvedValue(createParent());
    mockGradeLevelRepository.findById.mockResolvedValue(
      createGradeLevel(targetGradeLevelId),
    );
    mockSyeRepository.countChildEnrollments.mockResolvedValue(0);
    mockSyeRepository.correctGradeLevel.mockResolvedValue(
      createParent({
        gradeLevelId: targetGradeLevelId,
        gradeLevel: createGradeLevel(targetGradeLevelId),
      }),
    );
  };

  beforeEach(() => {
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

    useCase = new CorrectSchoolYearEnrollmentGradeUseCase(
      mockSyeRepository,
      mockGradeLevelRepository,
      runner,
      recorder,
    );
  });

  it("updates the parent grade when no child class enrollments exist", async () => {
    arrangeHappyPath();

    const result = await useCase.execute(
      {
        id: parentId,
        studentId,
        campusId,
        gradeLevelId: targetGradeLevelId,
      },
      stubActor,
    );

    expect(result.gradeLevelId).toBe(targetGradeLevelId);
    expect(mockSyeRepository.countChildEnrollments).toHaveBeenCalledWith(
      parentId,
    );
    expect(mockSyeRepository.correctGradeLevel).toHaveBeenCalledWith(
      parentId,
      targetGradeLevelId,
      stubTx,
    );

    expect(recorder.record).toHaveBeenCalledTimes(1);
    const [auditInput, txArg] = recorder.record.mock.calls[0];
    expect(auditInput).toMatchObject({
      actorId: stubActor.id,
      action: "CORRECT_SCHOOL_YEAR_ENROLLMENT_GRADE",
      targetType: "student",
      targetId: studentId,
      campusId,
      beforeValue: {
        schoolYearEnrollmentId: parentId,
        gradeLevelId: oldGradeLevelId,
        gradeLevelName: "Mam",
      },
      afterValue: {
        schoolYearEnrollmentId: parentId,
        gradeLevelId: targetGradeLevelId,
        gradeLevelName: "Choi",
      },
      context: {
        actorName: "Alice Nguyen",
        schoolYearEnrollmentId: parentId,
        schoolYearId,
        schoolYearName: "SY 2025-2026",
      },
    });
    expect(txArg).toBe(stubTx);
    expect(JSON.stringify(auditInput)).not.toContain("attendance");
    expect(
      JSON.stringify(mockSyeRepository.correctGradeLevel.mock.calls),
    ).not.toContain("attendance");
  });

  it("returns the parent unchanged when the target grade is already set and no child exists", async () => {
    const parent = createParent({ gradeLevelId: targetGradeLevelId });
    mockSyeRepository.findById.mockResolvedValue(parent);
    mockGradeLevelRepository.findById.mockResolvedValue(
      createGradeLevel(targetGradeLevelId),
    );
    mockSyeRepository.countChildEnrollments.mockResolvedValue(0);

    const result = await useCase.execute(
      {
        id: parentId,
        studentId,
        campusId,
        gradeLevelId: targetGradeLevelId,
      },
      stubActor,
    );

    expect(result).toBe(parent);
    expect(mockSyeRepository.correctGradeLevel).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("throws stable correction-not-allowed code/action when any child class enrollment exists", async () => {
    arrangeHappyPath();
    mockSyeRepository.countChildEnrollments.mockResolvedValue(1);

    let caught: unknown;
    try {
      await useCase.execute(
        {
          id: parentId,
          studentId,
          campusId,
          gradeLevelId: targetGradeLevelId,
        },
        stubActor,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    expect((caught as ConflictException).getResponse()).toMatchObject({
      code: SchoolYearEnrollmentErrorCode.GRADE_CORRECTION_NOT_ALLOWED,
      action:
        SchoolYearEnrollmentGradeCorrectionAction.USE_FUTURE_CORRECTION_WORKFLOW,
      reason: "CHILD_CLASS_ENROLLMENT_EXISTS",
      childEnrollmentCount: 1,
    });
    expect(mockSyeRepository.correctGradeLevel).not.toHaveBeenCalled();
    expect(recorder.record).not.toHaveBeenCalled();
  });

  it("throws stable correction-not-allowed code/action when the parent is closed", async () => {
    mockSyeRepository.findById.mockResolvedValue(
      createParent({
        exitDate: new Date("2026-06-30T00:00:00.000Z"),
        exitReason: ExitReason.COMPLETED,
      }),
    );

    let caught: unknown;
    try {
      await useCase.execute(
        {
          id: parentId,
          studentId,
          campusId,
          gradeLevelId: targetGradeLevelId,
        },
        stubActor,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ConflictException);
    expect((caught as ConflictException).getResponse()).toMatchObject({
      code: SchoolYearEnrollmentErrorCode.GRADE_CORRECTION_NOT_ALLOWED,
      action:
        SchoolYearEnrollmentGradeCorrectionAction.USE_FUTURE_CORRECTION_WORKFLOW,
      reason: "PARENT_CLOSED",
    });
    expect(mockGradeLevelRepository.findById).not.toHaveBeenCalled();
    expect(mockSyeRepository.countChildEnrollments).not.toHaveBeenCalled();
  });

  it("throws 404 when the parent is missing, cross-campus, or not for the route student", async () => {
    for (const parent of [
      null,
      createParent({ campusId: differentCampusId }),
      createParent({ studentId: "student-other" }),
    ]) {
      jest.clearAllMocks();
      mockSyeRepository.findById.mockResolvedValue(parent);

      await expect(
        useCase.execute(
          {
            id: parentId,
            studentId,
            campusId,
            gradeLevelId: targetGradeLevelId,
          },
          stubActor,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_ENROLLMENT_NOT_FOUND,
        ),
      );

      expect(mockGradeLevelRepository.findById).not.toHaveBeenCalled();
      expect(mockSyeRepository.correctGradeLevel).not.toHaveBeenCalled();
    }
  });

  it("throws 404 when the target grade is missing or cross-campus", async () => {
    for (const gradeLevel of [
      null,
      createGradeLevel(targetGradeLevelId, { campusId: differentCampusId }),
    ]) {
      jest.clearAllMocks();
      mockSyeRepository.findById.mockResolvedValue(createParent());
      mockGradeLevelRepository.findById.mockResolvedValue(gradeLevel);

      await expect(
        useCase.execute(
          {
            id: parentId,
            studentId,
            campusId,
            gradeLevelId: targetGradeLevelId,
          },
          stubActor,
        ),
      ).rejects.toThrow(
        new NotFoundException(
          SchoolYearEnrollmentErrorCode.GRADE_LEVEL_NOT_FOUND,
        ),
      );

      expect(mockSyeRepository.countChildEnrollments).not.toHaveBeenCalled();
      expect(mockSyeRepository.correctGradeLevel).not.toHaveBeenCalled();
    }
  });
});
