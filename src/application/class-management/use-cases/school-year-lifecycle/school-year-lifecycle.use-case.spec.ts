import { BadRequestException } from "@nestjs/common";

import {
  buildSchoolYearLifecycleDigest,
  toCanonicalLifecycleInput,
} from "../../school-year-lifecycle";
import { CommitSchoolYearLifecycleUseCase } from "./commit-school-year-lifecycle.use-case";
import { PreviewSchoolYearLifecycleUseCase } from "./preview-school-year-lifecycle.use-case";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { Student } from "@/domain/user-management/entities/student.entity";
import { createUser } from "@/test-utils/entity-factories";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const SOURCE_YEAR_ID = "22222222-2222-4222-a222-222222222222";
const TARGET_YEAR_ID = "33333333-3333-4333-a333-333333333333";
const STUDENT_ID = "44444444-4444-4444-a444-444444444444";
const SOURCE_GRADE_ID = "55555555-5555-4555-a555-555555555555";
const TARGET_GRADE_ID = "66666666-6666-4666-a666-666666666666";
const SOURCE_CLASS_ID = "77777777-7777-4777-a777-777777777777";
const TARGET_CLASS_ID = "88888888-8888-4888-a888-888888888888";
const SOURCE_SYE_ID = "99999999-9999-4999-a999-999999999999";
const SOURCE_ENROLLMENT_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const TARGET_SYE_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const TARGET_ENROLLMENT_ID = "cccccccc-cccc-4ccc-cccc-cccccccccccc";
const ACTOR_ID = "dddddddd-dddd-4ddd-addd-dddddddddddd";

describe("school-year lifecycle contracts", () => {
  it("builds a deterministic digest independent of row order", () => {
    const left = previewInput([
      { studentId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb" },
      { studentId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" },
    ]);
    const right = previewInput([
      { studentId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" },
      { studentId: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb" },
    ]);

    expect(buildSchoolYearLifecycleDigest(left)).toBe(
      buildSchoolYearLifecycleDigest(right),
    );
  });
});

describe("PreviewSchoolYearLifecycleUseCase", () => {
  it("rejects an empty legacy row list before it can expand to source-year work", async () => {
    const ctx = buildContext();
    const useCase = new PreviewSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    await expect(
      useCase.execute(previewInput([]), ctx.currentUser),
    ).rejects.toThrow("EXPLICIT_ROWS_REQUIRED");
    expect(ctx.schoolYearRepository.findById).not.toHaveBeenCalled();
    expect(
      ctx.lifecycleRepository.findOpenSourceCandidates,
    ).not.toHaveBeenCalled();
  });

  it("does not default a missing target class to graduation", async () => {
    const ctx = buildContext();
    const useCase = new PreviewSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    const result = await useCase.execute(
      previewInput([{ studentId: STUDENT_ID }]),
      ctx.currentUser,
    );

    expect(result.rows[0]).toMatchObject({
      outcome: "PROMOTE",
      status: "CONFLICT",
      conflictCode: "MISSING_TARGET_CLASS",
    });
  });

  it("returns proposed promotion operations and persists preview metadata without lifecycle writes", async () => {
    const ctx = buildContext();
    const useCase = new PreviewSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    const result = await useCase.execute(
      previewInput([{ studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID }]),
      ctx.currentUser,
    );

    expect(result.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      studentId: STUDENT_ID,
      outcome: "PROMOTE",
      status: "READY",
      conflictCodes: [],
    });
    expect(result.rows[0].operations.map((op) => op.type)).toEqual([
      "CLOSE_SOURCE_SCHOOL_YEAR_ENROLLMENT",
      "CLOSE_SOURCE_CLASS_ENROLLMENT",
      "CREATE_TARGET_SCHOOL_YEAR_ENROLLMENT",
      "CREATE_TARGET_CLASS_ENROLLMENT",
    ]);
    expect(ctx.lifecycleRepository.savePreviewRun).toHaveBeenCalledWith(
      expect.objectContaining({
        digest: result.digest,
        requestPayload: toCanonicalLifecycleInput(
          previewInput([
            {
              studentId: STUDENT_ID,
              targetClassId: TARGET_CLASS_ID,
              outcome: "PROMOTE",
            },
          ]),
        ),
      }),
      expect.anything(),
    );
    expect(ctx.schoolYearEnrollmentRepository.save).not.toHaveBeenCalled();
    expect(ctx.enrollmentRepository.save).not.toHaveBeenCalled();
    expect(ctx.recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "PREVIEW_SCHOOL_YEAR_LIFECYCLE",
        targetType: "school_year",
      }),
      expect.anything(),
    );
  });

  it("reports stable preview conflicts for existing target registration, missing target class, and invalid date", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.findOpenTargetRegistrationStudentIds.mockResolvedValue(
      [STUDENT_ID],
    );
    ctx.lifecycleRepository.findCancelledTargetRegistrationStudentIds.mockResolvedValue(
      [STUDENT_ID],
    );
    const useCase = new PreviewSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    const result = await useCase.execute(
      {
        ...previewInput([
          { studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID },
        ]),
        sourceClosureDate: new Date("2027-07-01T00:00:00.000Z"),
      },
      ctx.currentUser,
    );

    expect(result.rows[0]).toMatchObject({
      status: "CONFLICT",
      conflictCodes: [
        "INVALID_DATE",
        "EXISTING_TARGET_REGISTRATION",
        "CANCELLED_TARGET_REGISTRATION",
      ],
    });

    ctx.classRepository.findByIds.mockResolvedValue([]);
    ctx.lifecycleRepository.findOpenTargetRegistrationStudentIds.mockResolvedValue(
      [],
    );
    ctx.lifecycleRepository.findCancelledTargetRegistrationStudentIds.mockResolvedValue(
      [],
    );
    const missingClass = await useCase.execute(
      previewInput([{ studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID }]),
      ctx.currentUser,
    );
    expect(missingClass.rows[0].conflictCodes).toContain(
      "MISSING_TARGET_CLASS",
    );
  });
});

describe("CommitSchoolYearLifecycleUseCase", () => {
  it("applies a promoted row in one row transaction and audits the row and batch", async () => {
    const ctx = buildContext();
    const useCase = new CommitSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.enrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );
    const digest = buildSchoolYearLifecycleDigest(
      previewInput([{ studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID }]),
    );
    ctx.lifecycleRepository.findPreviewRunById.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
      lifecycleRunId: "lifecycle-run-1",
      status: "COMMITTING",
      campusId: CAMPUS_ID,
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
      targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      digest,
      requestPayload: toCanonicalLifecycleInput(
        previewInput([
          { studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID },
        ]),
      ),
      resultPayload: {},
      createdByUserId: ACTOR_ID,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        previewRunId: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
        digest,
        allowRunScoped: true,
        lifecycleRunId: "lifecycle-run-1",
        commitAttemptId: "attempt-1",
        candidateIdsByStudentId: { [STUDENT_ID]: "candidate-1" },
      },
      ctx.currentUser,
    );

    expect(result.rows[0]).toMatchObject({
      studentId: STUDENT_ID,
      outcome: "PROMOTE",
      status: "SUCCESS",
    });
    const [closedParent, closedChild] =
      ctx.lifecycleRepository.closeSourceEnrollmentsForCommit.mock.calls[0];
    expect(closedParent.exitReason).toBe(ExitReason.COMPLETED);
    expect(closedChild?.exitReason).toBe(ExitReason.COMPLETED);
    expect(ctx.schoolYearEnrollmentRepository.save).toHaveBeenCalledTimes(1);
    expect(ctx.enrollmentRepository.save).toHaveBeenCalledTimes(1);
    expect(
      ctx.lifecycleRepository.persistSuccessfulCommitRow,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        commitAttemptId: "attempt-1",
        lifecycleRunId: "lifecycle-run-1",
        candidateId: "candidate-1",
        result: expect.objectContaining({ status: "SUCCESS" }),
      }),
      expect.anything(),
    );
    expect(ctx.recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "COMMIT_SCHOOL_YEAR_LIFECYCLE_ROW",
        targetType: "student",
      }),
      expect.anything(),
    );
    expect(ctx.recorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "COMMIT_SCHOOL_YEAR_LIFECYCLE",
        targetType: "school_year",
      }),
      expect.anything(),
    );
  });

  it("returns overlap context and performs no lifecycle writes when preflight finds a conflicting period", async () => {
    const ctx = buildContext();
    const input = previewInput([
      { studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID },
    ]);
    const digest = buildSchoolYearLifecycleDigest(input);
    ctx.lifecycleRepository.findPreviewRunById.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
      campusId: CAMPUS_ID,
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
      targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      digest,
      requestPayload: toCanonicalLifecycleInput(input),
      resultPayload: {},
      createdByUserId: ACTOR_ID,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    ctx.enrollmentRepository.findOverlappingByStudentId.mockResolvedValue(
      ctx.targetEnrollment,
    );
    const useCase = new CommitSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.enrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        previewRunId: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
        digest,
      },
      ctx.currentUser,
    );

    expect(result.rows[0]).toMatchObject({
      status: "FAILED",
      conflictCode: "ENROLLMENT_PERIOD_OVERLAP",
      message: "ENROLLMENT_PERIOD_OVERLAP",
      context: {
        conflictingEnrollment: {
          id: TARGET_ENROLLMENT_ID,
          classId: TARGET_CLASS_ID,
          className: "B",
          enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
          endDate: null,
        },
      },
    });
    expect(
      ctx.lifecycleRepository.closeSourceEnrollmentsForCommit,
    ).not.toHaveBeenCalled();
    expect(ctx.schoolYearEnrollmentRepository.save).not.toHaveBeenCalled();
    expect(ctx.enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("classifies a target-parent uniqueness race separately from class-period overlap", async () => {
    const ctx = buildContext();
    const input = previewInput([
      { studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID },
    ]);
    const digest = buildSchoolYearLifecycleDigest(input);
    ctx.lifecycleRepository.findPreviewRunById.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
      campusId: CAMPUS_ID,
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
      targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      digest,
      requestPayload: toCanonicalLifecycleInput(input),
      resultPayload: {},
      createdByUserId: ACTOR_ID,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    ctx.schoolYearEnrollmentRepository.save.mockRejectedValue({
      code: "P2002",
      message: "Unique constraint failed",
    });
    const useCase = new CommitSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.enrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        previewRunId: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
        digest,
      },
      ctx.currentUser,
    );

    expect(result.rows[0]).toMatchObject({
      status: "FAILED",
      conflictCode: "EXISTING_TARGET_REGISTRATION",
      message: "EXISTING_TARGET_REGISTRATION",
    });
    expect(result.rows[0].conflictCode).not.toBe("ENROLLMENT_PERIOD_OVERLAP");
    expect(ctx.enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("leaves skipped rows unchanged and graduates explicit graduate rows without target records", async () => {
    const ctx = buildContext();
    const useCase = new CommitSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.enrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );
    const input = previewInput([
      { studentId: STUDENT_ID, outcome: "GRADUATE" },
      {
        studentId: "abababab-abab-4aba-abab-abababababab",
        outcome: "SKIP",
      },
    ]);
    const digest = buildSchoolYearLifecycleDigest(input);
    const skippedCandidate = makeCandidate(
      "abababab-abab-4aba-abab-abababababab",
      "cdcdcdcd-cdcd-4cdc-acdc-cdcdcdcdcdcd",
      "efefefef-efef-4efe-aefe-efefefefefef",
    );
    ctx.lifecycleRepository.findOpenSourceCandidates.mockResolvedValue([
      ctx.candidate,
      skippedCandidate,
    ]);
    ctx.lifecycleRepository.findPreviewRunById.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
      campusId: CAMPUS_ID,
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
      targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      digest,
      requestPayload: toCanonicalLifecycleInput(input),
      resultPayload: {},
      createdByUserId: ACTOR_ID,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        previewRunId: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
        digest,
      },
      ctx.currentUser,
    );

    expect(result.rows.map((row) => row.status)).toEqual([
      "SUCCESS",
      "SKIPPED",
    ]);
    const [closedParent] =
      ctx.lifecycleRepository.closeSourceEnrollmentsForCommit.mock.calls[0];
    expect(closedParent.exitReason).toBe(ExitReason.GRADUATED);
    expect(ctx.schoolYearEnrollmentRepository.save).not.toHaveBeenCalled();
    expect(ctx.enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("classifies retried rows as already applied after source closure and target creation", async () => {
    const ctx = buildContext();
    const input = previewInput([
      { studentId: STUDENT_ID, targetClassId: TARGET_CLASS_ID },
    ]);
    const digest = buildSchoolYearLifecycleDigest(input);
    ctx.lifecycleRepository.findOpenSourceCandidates.mockResolvedValue([]);
    ctx.lifecycleRepository.findPreviewRunById.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
      campusId: CAMPUS_ID,
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
      targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      digest,
      requestPayload: toCanonicalLifecycleInput(input),
      resultPayload: {},
      createdByUserId: ACTOR_ID,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    ctx.schoolYearEnrollmentRepository.findLatestByStudentAndSchoolYear.mockResolvedValue(
      makeSchoolYearEnrollment(STUDENT_ID, {
        id: SOURCE_SYE_ID,
        exitDate: new Date("2026-06-30T00:00:00.000Z"),
        exitReason: ExitReason.COMPLETED,
      }),
    );
    ctx.schoolYearEnrollmentRepository.findOpenByStudentAndSchoolYear.mockResolvedValue(
      ctx.targetParent,
    );
    ctx.enrollmentRepository.findByStudentClassDate.mockResolvedValue(
      ctx.targetEnrollment,
    );

    const useCase = new CommitSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.enrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        previewRunId: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
        digest,
      },
      ctx.currentUser,
    );

    expect(result.rows[0].status).toBe("ALREADY_APPLIED");
    expect(
      ctx.lifecycleRepository.closeSourceEnrollmentsForCommit,
    ).not.toHaveBeenCalled();
    expect(ctx.schoolYearEnrollmentRepository.save).not.toHaveBeenCalled();
    expect(ctx.enrollmentRepository.save).not.toHaveBeenCalled();
  });

  it("rejects mismatched preview digests before row processing", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.findPreviewRunById.mockResolvedValue({
      id: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
      campusId: CAMPUS_ID,
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
      targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      digest: "0".repeat(64),
      requestPayload: {},
      resultPayload: {},
      createdByUserId: ACTOR_ID,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    });
    const useCase = new CommitSchoolYearLifecycleUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.schoolYearEnrollmentRepository,
      ctx.enrollmentRepository,
      ctx.classRepository,
      ctx.transactionRunner,
      ctx.recorder,
    );

    await expect(
      useCase.execute(
        {
          campusId: CAMPUS_ID,
          previewRunId: "eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee",
          digest: "1".repeat(64),
        },
        ctx.currentUser,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      ctx.lifecycleRepository.findOpenSourceCandidates,
    ).not.toHaveBeenCalled();
  });
});

function buildContext() {
  const sourceYear = SchoolYear.create(
    {
      campusId: CAMPUS_ID,
      name: "2025-2026",
      startDate: new Date("2025-09-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    },
    SOURCE_YEAR_ID,
  );
  const targetYear = SchoolYear.create(
    {
      campusId: CAMPUS_ID,
      name: "2026-2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-06-30T00:00:00.000Z"),
    },
    TARGET_YEAR_ID,
  );
  const sourceGrade = GradeLevel.create(
    { campusId: CAMPUS_ID, name: "Grade 1", order: 1 },
    SOURCE_GRADE_ID,
  );
  const targetGrade = GradeLevel.create(
    { campusId: CAMPUS_ID, name: "Grade 2", order: 2 },
    TARGET_GRADE_ID,
  );
  const sourceClass = Class.create(
    {
      campusId: CAMPUS_ID,
      name: "A",
      gradeLevelId: SOURCE_GRADE_ID,
      schoolYearId: SOURCE_YEAR_ID,
      gradeLevel: sourceGrade,
      schoolYear: sourceYear,
    },
    SOURCE_CLASS_ID,
  );
  const targetClass = Class.create(
    {
      campusId: CAMPUS_ID,
      name: "B",
      gradeLevelId: TARGET_GRADE_ID,
      schoolYearId: TARGET_YEAR_ID,
      gradeLevel: targetGrade,
      schoolYear: targetYear,
    },
    TARGET_CLASS_ID,
  );
  const candidate = makeCandidate(
    STUDENT_ID,
    SOURCE_SYE_ID,
    SOURCE_ENROLLMENT_ID,
  );
  const targetParent = makeSchoolYearEnrollment(STUDENT_ID, {
    id: TARGET_SYE_ID,
    schoolYear: targetYear,
    schoolYearId: TARGET_YEAR_ID,
    gradeLevel: targetGrade,
    gradeLevelId: TARGET_GRADE_ID,
    enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
  });
  const targetEnrollment = Enrollment.create(
    {
      classId: TARGET_CLASS_ID,
      studentId: STUDENT_ID,
      schoolYearEnrollmentId: TARGET_SYE_ID,
      enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
      class: targetClass,
      student: candidate.schoolYearEnrollment.student,
    },
    TARGET_ENROLLMENT_ID,
  );

  const lifecycleRepository = {
    findOpenSourceCandidates: jest.fn().mockResolvedValue([candidate]),
    findOpenTargetRegistrationStudentIds: jest.fn().mockResolvedValue([]),
    findCancelledTargetRegistrationStudentIds: jest.fn().mockResolvedValue([]),
    findPreviewRunById: jest.fn(),
    persistSuccessfulCommitRow: jest.fn().mockResolvedValue(undefined),
    closeSourceEnrollmentsForCommit: jest.fn().mockResolvedValue(undefined),
    assertTargetRegistrationCanBeCreated: jest
      .fn()
      .mockResolvedValue(undefined),
    savePreviewRun: jest.fn(async (input) => ({
      ...input,
      id: input.id,
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
    })),
  } as any;
  const schoolYearRepository = {
    findById: jest.fn(async (id) =>
      id === SOURCE_YEAR_ID
        ? sourceYear
        : id === TARGET_YEAR_ID
          ? targetYear
          : null,
    ),
  } as any;
  const schoolYearEnrollmentRepository = {
    findOpenByStudentAndSchoolYear: jest.fn().mockResolvedValue(null),
    findCoveringDateByStudentAndSchoolYear: jest.fn((studentId, schoolYearId) =>
      schoolYearEnrollmentRepository.findOpenByStudentAndSchoolYear(
        studentId,
        schoolYearId,
      ),
    ),
    findLatestByStudentAndSchoolYear: jest
      .fn()
      .mockResolvedValue(candidate.schoolYearEnrollment),
    save: jest.fn(async (entity) => entity),
  } as any;
  const enrollmentRepository = {
    findByStudentClassDate: jest.fn().mockResolvedValue(null),
    findOverlappingByStudentId: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (entity) => entity),
  } as any;
  const classRepository = {
    findByIds: jest.fn().mockResolvedValue([targetClass]),
  } as any;
  const transactionRunner = {
    run: jest.fn(async (task) => task({})),
  } as any;
  const recorder = {
    record: jest.fn().mockResolvedValue(undefined),
  } as any;
  const currentUser = createUser({
    id: ACTOR_ID,
    profile: {
      type: "staff",
      id: "12121212-1212-4121-a121-121212121212",
      campusId: CAMPUS_ID,
      fullName: "Admin Actor",
      email: null,
      phoneNumber: null,
      dateOfBirth: null,
      gender: null,
    },
  });

  return {
    sourceYear,
    targetYear,
    sourceGrade,
    targetGrade,
    sourceClass,
    targetClass,
    candidate,
    targetParent,
    targetEnrollment,
    lifecycleRepository,
    schoolYearRepository,
    schoolYearEnrollmentRepository,
    enrollmentRepository,
    classRepository,
    transactionRunner,
    recorder,
    currentUser,
  };
}

function previewInput(rows: Array<any>) {
  return {
    campusId: CAMPUS_ID,
    sourceSchoolYearId: SOURCE_YEAR_ID,
    targetSchoolYearId: TARGET_YEAR_ID,
    sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
    targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    rows,
  };
}

function makeCandidate(studentId: string, syeId: string, enrollmentId: string) {
  const sourceYear = SchoolYear.create(
    {
      campusId: CAMPUS_ID,
      name: "2025-2026",
      startDate: new Date("2025-09-01T00:00:00.000Z"),
      endDate: new Date("2026-06-30T00:00:00.000Z"),
    },
    SOURCE_YEAR_ID,
  );
  const sourceGrade = GradeLevel.create(
    { campusId: CAMPUS_ID, name: "Grade 1", order: 1 },
    SOURCE_GRADE_ID,
  );
  const sourceClass = Class.create(
    {
      campusId: CAMPUS_ID,
      name: "A",
      gradeLevelId: SOURCE_GRADE_ID,
      schoolYearId: SOURCE_YEAR_ID,
      gradeLevel: sourceGrade,
      schoolYear: sourceYear,
    },
    SOURCE_CLASS_ID,
  );
  const student = Student.create(
    {
      campusId: CAMPUS_ID,
      studentCode: `S-${studentId.slice(0, 4)}`,
      fullName: `Student ${studentId.slice(0, 4)}`,
      email: null,
      phoneNumber: null,
      address: null,
      dateOfBirth: null,
      nickname: null,
      gender: null,
      isArchived: false,
    },
    studentId,
  );
  const schoolYearEnrollment = makeSchoolYearEnrollment(studentId, {
    id: syeId,
    schoolYear: sourceYear,
    gradeLevel: sourceGrade,
    student,
  });
  const activeEnrollment = Enrollment.create(
    {
      classId: SOURCE_CLASS_ID,
      studentId,
      schoolYearEnrollmentId: syeId,
      enrollmentDate: new Date("2025-09-01T00:00:00.000Z"),
      class: sourceClass,
      student,
      schoolYearEnrollment,
    },
    enrollmentId,
  );
  return { schoolYearEnrollment, activeEnrollment };
}

function makeSchoolYearEnrollment(
  studentId: string,
  overrides: Partial<{
    id: string;
    schoolYear: SchoolYear;
    schoolYearId: string;
    gradeLevel: GradeLevel;
    gradeLevelId: string;
    student: Student;
    enrollmentDate: Date;
    exitDate: Date | null;
    exitReason: ExitReason | null;
  }> = {},
) {
  const schoolYear =
    overrides.schoolYear ??
    SchoolYear.create(
      {
        campusId: CAMPUS_ID,
        name: "2025-2026",
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2026-06-30T00:00:00.000Z"),
      },
      overrides.schoolYearId ?? SOURCE_YEAR_ID,
    );
  const gradeLevel =
    overrides.gradeLevel ??
    GradeLevel.create(
      { campusId: CAMPUS_ID, name: "Grade 1", order: 1 },
      overrides.gradeLevelId ?? SOURCE_GRADE_ID,
    );
  const student =
    overrides.student ??
    Student.create(
      {
        campusId: CAMPUS_ID,
        studentCode: `S-${studentId.slice(0, 4)}`,
        fullName: `Student ${studentId.slice(0, 4)}`,
        email: null,
        phoneNumber: null,
        address: null,
        dateOfBirth: null,
        nickname: null,
        gender: null,
        isArchived: false,
      },
      studentId,
    );
  return SchoolYearEnrollment.create(
    {
      studentId,
      campusId: CAMPUS_ID,
      schoolYearId: overrides.schoolYearId ?? schoolYear.id,
      gradeLevelId: overrides.gradeLevelId ?? gradeLevel.id,
      enrollmentDate:
        overrides.enrollmentDate ?? new Date("2025-09-01T00:00:00.000Z"),
      exitDate: overrides.exitDate ?? null,
      exitReason: overrides.exitReason ?? null,
      schoolYear,
      gradeLevel,
      student,
    },
    overrides.id ?? SOURCE_SYE_ID,
  );
}
