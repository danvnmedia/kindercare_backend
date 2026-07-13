import { BadRequestException } from "@nestjs/common";

import { createUser } from "@/test-utils/entity-factories";

import { PreviewSchoolYearLifecycleRunUseCase } from "./preview-school-year-lifecycle-run.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const RUN_ID = "22222222-2222-4222-a222-222222222222";
const SOURCE_YEAR_ID = "33333333-3333-4333-a333-333333333333";
const TARGET_YEAR_ID = "44444444-4444-4444-a444-444444444444";
const SOURCE_CLASS_ID = "55555555-5555-4555-a555-555555555555";
const TARGET_CLASS_ID = "66666666-6666-4666-a666-666666666666";
const ACTOR_ID = "77777777-7777-4777-a777-777777777777";

const now = new Date("2026-07-10T12:00:00.000Z");
const run = {
  id: RUN_ID,
  campusId: CAMPUS_ID,
  sourceSchoolYearId: SOURCE_YEAR_ID,
  targetSchoolYearId: TARGET_YEAR_ID,
  sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
  targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
  status: "DRAFT",
  version: 4,
} as any;
const sourceYear = {
  id: SOURCE_YEAR_ID,
  campusId: CAMPUS_ID,
  startDate: new Date("2025-09-01T00:00:00.000Z"),
  endDate: new Date("2026-06-30T00:00:00.000Z"),
} as any;
const targetYear = {
  id: TARGET_YEAR_ID,
  campusId: CAMPUS_ID,
  startDate: new Date("2026-09-01T00:00:00.000Z"),
  endDate: new Date("2027-06-30T00:00:00.000Z"),
} as any;
const targetClass = {
  id: TARGET_CLASS_ID,
  campusId: CAMPUS_ID,
  schoolYearId: TARGET_YEAR_ID,
  gradeLevelId: "grade-2",
  name: "Target",
  gradeLevel: { id: "grade-2", name: "Grade 2", order: 2 },
} as any;
const sourceClass = {
  id: SOURCE_CLASS_ID,
  campusId: CAMPUS_ID,
  schoolYearId: SOURCE_YEAR_ID,
  gradeLevelId: "grade-1",
} as any;

function persistedCandidate(
  index: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    id: `candidate-${String(index).padStart(4, "0")}`,
    lifecycleRunId: RUN_ID,
    campusId: CAMPUS_ID,
    studentId: `student-${String(index).padStart(4, "0")}`,
    sourceSchoolYearEnrollmentId: `sye-${index}`,
    sourceEnrollmentId: `enrollment-${index}`,
    sourceGradeLevelId: "grade-1",
    sourceClassId: SOURCE_CLASS_ID,
    status: "READY",
    recommendedOutcome: "PROMOTE",
    decision: "PROMOTE",
    targetGradeLevelId: "grade-2",
    targetClassId: TARGET_CLASS_ID,
    decisionNote: null,
    conflictCode: null,
    message: null,
    rowVersion: 1,
    committedAt: null,
    ...overrides,
  } as any;
}

function sourceCandidate(candidate: any) {
  return {
    schoolYearEnrollment: {
      id: candidate.sourceSchoolYearEnrollmentId,
      studentId: candidate.studentId,
      gradeLevelId: candidate.sourceGradeLevelId,
      gradeLevel: { id: "grade-1", name: "Grade 1", order: 1 },
      student: { fullName: candidate.studentId },
    },
    activeEnrollment: {
      id: candidate.sourceEnrollmentId,
      classId: candidate.sourceClassId,
    },
  } as any;
}

function buildContext(candidates: any[]) {
  const lifecycleRepository = {
    findRunById: jest.fn().mockResolvedValue(run),
    findCandidatesByIds: jest.fn().mockResolvedValue(candidates),
    findCandidatesByFilter: jest.fn().mockResolvedValue(candidates),
    findCandidatesBySourceClassIds: jest.fn().mockResolvedValue(candidates),
    findOpenSourceCandidates: jest
      .fn()
      .mockImplementation(async (_campusId, _yearId, studentIds) =>
        candidates
          .filter((candidate) => studentIds.includes(candidate.studentId))
          .map(sourceCandidate),
      ),
    findOpenTargetRegistrationStudentIds: jest.fn().mockResolvedValue([]),
    findCancelledTargetRegistrationStudentIds: jest.fn().mockResolvedValue([]),
    saveRunScopedPreview: jest.fn().mockResolvedValue({
      previewRun: {},
      supersededPreviewIds: [],
    }),
  } as any;
  const schoolYearRepository = {
    findById: jest.fn(async (id) =>
      id === SOURCE_YEAR_ID ? sourceYear : targetYear,
    ),
  } as any;
  const classRepository = {
    findByIds: jest.fn(async (ids) =>
      ids.includes(SOURCE_CLASS_ID) ? [sourceClass] : [targetClass],
    ),
  } as any;
  const gradeLevelRepository = {
    findById: jest.fn().mockResolvedValue({
      id: "grade-1",
      campusId: CAMPUS_ID,
      order: 1,
    }),
  } as any;
  return {
    lifecycleRepository,
    schoolYearRepository,
    classRepository,
    gradeLevelRepository,
    useCase: new PreviewSchoolYearLifecycleRunUseCase(
      lifecycleRepository,
      schoolYearRepository,
      {} as any,
      classRepository,
      gradeLevelRepository,
    ),
  };
}

describe("PreviewSchoolYearLifecycleRunUseCase", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("materializes only the exact explicit run candidates with a 24-hour expiry", async () => {
    const candidates = [persistedCandidate(1), persistedCandidate(2)];
    const ctx = buildContext(candidates);

    const result = await ctx.useCase.execute(
      {
        lifecycleRunId: RUN_ID,
        campusId: CAMPUS_ID,
        expectedVersion: 4,
        scope: {
          type: "STUDENTS",
          candidateIds: candidates.map((candidate) => candidate.id),
        },
      },
      createUser({ id: ACTOR_ID }),
    );

    expect(result).toMatchObject({
      lifecycleRunId: RUN_ID,
      runVersion: 4,
      scopeType: "STUDENTS",
      summary: { rowCount: 2, readyCount: 2, conflictCount: 0 },
    });
    expect(result.expiresAt.toISOString()).toBe("2026-07-11T12:00:00.000Z");
    expect(ctx.lifecycleRepository.saveRunScopedPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleRunId: RUN_ID,
        runVersion: 4,
        expiresAt: result.expiresAt,
        candidates: [
          expect.objectContaining({
            candidateId: candidates[0].id,
            sequence: 0,
          }),
          expect.objectContaining({
            candidateId: candidates[1].id,
            sequence: 1,
          }),
        ],
      }),
    );
    expect(
      ctx.lifecycleRepository.findOpenTargetRegistrationStudentIds,
    ).toHaveBeenCalledTimes(1);
  });

  it("rejects a preview when cancellation wins the persistence race", async () => {
    const candidates = [persistedCandidate(1)];
    const ctx = buildContext(candidates);
    ctx.lifecycleRepository.saveRunScopedPreview.mockResolvedValueOnce(null);

    await expect(
      ctx.useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          expectedVersion: 4,
          scope: {
            type: "STUDENTS",
            candidateIds: [candidates[0].id],
          },
        },
        createUser({ id: ACTOR_ID }),
      ),
    ).rejects.toThrow("SOURCE_REGISTRATION_CANCELLED");
  });

  it("returns stable non-overlapping descriptors for an oversized class", async () => {
    const candidates = Array.from({ length: 600 }, (_, index) =>
      persistedCandidate(index, {
        decision: "SKIP",
        targetGradeLevelId: null,
        targetClassId: null,
      }),
    );
    const ctx = buildContext(candidates);
    const execute = () =>
      ctx.useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          expectedVersion: 4,
          scope: { type: "CLASSES" as const, classIds: [SOURCE_CLASS_ID] },
        },
        createUser({ id: ACTOR_ID }),
      );

    let firstResponse: any;
    try {
      await execute();
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      firstResponse = (error as BadRequestException).getResponse();
    }
    let secondResponse: any;
    try {
      await execute();
    } catch (error) {
      secondResponse = (error as BadRequestException).getResponse();
    }

    expect(firstResponse).toMatchObject({
      code: "SCOPE_TOO_LARGE",
      maximum: 500,
      candidateCount: 600,
      batches: [
        expect.objectContaining({ batchIndex: 0, candidateCount: 500 }),
        expect.objectContaining({ batchIndex: 1, candidateCount: 100 }),
      ],
    });
    expect(secondResponse.batches.map((batch) => batch.batchId)).toEqual(
      firstResponse.batches.map((batch) => batch.batchId),
    );
    expect(ctx.lifecycleRepository.saveRunScopedPreview).not.toHaveBeenCalled();
  });

  it("returns deterministic grade and class guidance for a 2,000-candidate scope", async () => {
    const candidates = Array.from({ length: 2_000 }, (_, index) =>
      persistedCandidate(index, {
        decision: "SKIP",
        targetGradeLevelId: null,
        targetClassId: null,
      }),
    );
    const ctx = buildContext(candidates);
    const preview = async (scope: Record<string, unknown>) => {
      try {
        await ctx.useCase.execute(
          {
            lifecycleRunId: RUN_ID,
            campusId: CAMPUS_ID,
            expectedVersion: 4,
            scope: scope as any,
          },
          createUser({ id: ACTOR_ID }),
        );
      } catch (error) {
        return (error as BadRequestException).getResponse() as any;
      }
      throw new Error("Expected oversized scope rejection");
    };

    const grade = await preview({ type: "GRADE", gradeLevelId: "grade-1" });
    const firstClass = await preview({
      type: "CLASSES",
      classIds: [SOURCE_CLASS_ID],
    });
    const secondClass = await preview({
      type: "CLASSES",
      classIds: [SOURCE_CLASS_ID],
    });

    for (const response of [grade, firstClass]) {
      expect(response).toMatchObject({
        code: "SCOPE_TOO_LARGE",
        maximum: 500,
        candidateCount: 2_000,
      });
      expect(response.batches).toHaveLength(4);
      expect(response.batches.map((batch) => batch.candidateCount)).toEqual([
        500, 500, 500, 500,
      ]);
    }
    expect(secondClass.batches.map((batch) => batch.batchId)).toEqual(
      firstClass.batches.map((batch) => batch.batchId),
    );
  });

  it("previews one deterministic oversized-class batch within the maximum", async () => {
    const candidates = Array.from({ length: 600 }, (_, index) =>
      persistedCandidate(index, {
        decision: "SKIP",
        targetGradeLevelId: null,
        targetClassId: null,
      }),
    );
    const ctx = buildContext(candidates);

    const result = await ctx.useCase.execute(
      {
        lifecycleRunId: RUN_ID,
        campusId: CAMPUS_ID,
        expectedVersion: 4,
        scope: {
          type: "CLASSES",
          classIds: [SOURCE_CLASS_ID],
          batchIndex: 1,
        },
      },
      createUser({ id: ACTOR_ID }),
    );

    expect(result.summary).toMatchObject({ rowCount: 100, skippedCount: 100 });
    const persisted =
      ctx.lifecycleRepository.saveRunScopedPreview.mock.calls[0][0];
    expect(persisted.candidates).toHaveLength(100);
    expect(persisted.candidates[0].candidateId).toBe("candidate-0500");
    expect(persisted.candidates[99].candidateId).toBe("candidate-0599");
  });
});
