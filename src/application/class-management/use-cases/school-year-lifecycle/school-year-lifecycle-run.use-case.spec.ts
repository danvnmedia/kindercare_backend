import { ConflictException, NotFoundException } from "@nestjs/common";

import { createUser } from "@/test-utils/entity-factories";

import { CancelSchoolYearLifecycleRunUseCase } from "./cancel-school-year-lifecycle-run.use-case";
import { CreateOrResumeSchoolYearLifecycleRunUseCase } from "./create-or-resume-school-year-lifecycle-run.use-case";
import { UpdateSchoolYearLifecycleRunSetupUseCase } from "./update-school-year-lifecycle-run-setup.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const SOURCE_YEAR_ID = "22222222-2222-4222-a222-222222222222";
const TARGET_YEAR_ID = "33333333-3333-4333-a333-333333333333";
const RUN_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";

const sourceSchoolYear = {
  id: SOURCE_YEAR_ID,
  campusId: CAMPUS_ID,
  name: "2025-2026",
  startDate: new Date("2025-09-01T00:00:00.000Z"),
  endDate: new Date("2026-06-30T00:00:00.000Z"),
};
const targetSchoolYear = {
  id: TARGET_YEAR_ID,
  campusId: CAMPUS_ID,
  name: "2026-2027",
  startDate: new Date("2026-09-01T00:00:00.000Z"),
  endDate: new Date("2027-06-30T00:00:00.000Z"),
};
const actor = createUser({ id: ACTOR_ID });

function makeRun(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-10T12:00:00.000Z");
  return {
    id: RUN_ID,
    campusId: CAMPUS_ID,
    sourceSchoolYearId: SOURCE_YEAR_ID,
    targetSchoolYearId: TARGET_YEAR_ID,
    sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
    targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
    status: "DRAFT",
    version: 1,
    createdByUserId: ACTOR_ID,
    updatedByUserId: null,
    firstCommittedAt: null,
    completedAt: null,
    cancelledAt: null,
    expiredAt: null,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as any;
}

function buildContext() {
  const lifecycleRepository = {
    findActiveRun: jest.fn().mockResolvedValue(null),
    findOpenSourceCandidates: jest.fn().mockResolvedValue([
      {
        schoolYearEnrollment: {
          id: "sye-1",
          studentId: "student-1",
          gradeLevelId: "grade-1",
          gradeLevel: { order: 1 },
        },
        activeEnrollment: { id: "enrollment-1", classId: "class-1" },
      },
      {
        schoolYearEnrollment: {
          id: "sye-2",
          studentId: "student-2",
          gradeLevelId: "grade-2",
          gradeLevel: { order: 2 },
        },
        activeEnrollment: null,
      },
    ]),
    findOrCreateRun: jest.fn(async (input) => ({
      run: makeRun({ id: input.id }),
      created: true,
    })),
    findCandidateAggregates: jest.fn().mockResolvedValue([
      {
        sourceGradeLevelId: "grade-1",
        sourceGradeLevelName: "Grade 1",
        sourceGradeLevelOrder: 1,
        sourceClassId: "class-1",
        sourceClassName: "A",
        status: "NOT_STARTED",
        decision: null,
        targetClassId: null,
        count: 1,
      },
      {
        sourceGradeLevelId: "grade-2",
        sourceGradeLevelName: "Grade 2",
        sourceGradeLevelOrder: 2,
        sourceClassId: null,
        sourceClassName: null,
        status: "READY",
        decision: "GRADUATE",
        targetClassId: null,
        count: 1,
      },
    ]),
    findRunById: jest.fn().mockResolvedValue(makeRun()),
    updateRunVersioned: jest.fn(),
  } as any;
  const schoolYearRepository = {
    findById: jest.fn(async (id) =>
      id === SOURCE_YEAR_ID
        ? sourceSchoolYear
        : id === TARGET_YEAR_ID
          ? targetSchoolYear
          : null,
    ),
    findNonArchived: jest
      .fn()
      .mockResolvedValue([sourceSchoolYear, targetSchoolYear]),
  } as any;
  const gradeLevelRepository = {
    findNonArchived: jest.fn().mockResolvedValue([
      { id: "grade-1", order: 1 },
      { id: "grade-2", order: 2 },
    ]),
  } as any;
  return {
    lifecycleRepository,
    schoolYearRepository,
    gradeLevelRepository,
  };
}

describe("CreateOrResumeSchoolYearLifecycleRunUseCase", () => {
  it("atomically supplies the full initial snapshot and returns progress", async () => {
    const ctx = buildContext();
    const useCase = new CreateOrResumeSchoolYearLifecycleRunUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.gradeLevelRepository,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        sourceSchoolYearId: SOURCE_YEAR_ID,
        targetSchoolYearId: TARGET_YEAR_ID,
        sourceClosureDate: sourceSchoolYear.endDate,
        targetEnrollmentDate: targetSchoolYear.startDate,
      },
      actor,
    );

    const [, candidates] =
      ctx.lifecycleRepository.findOrCreateRun.mock.calls[0];
    expect(candidates).toHaveLength(2);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          studentId: "student-1",
          recommendedOutcome: "PROMOTE",
          status: "NOT_STARTED",
          decision: null,
          targetGradeLevelId: "grade-2",
        }),
        expect.objectContaining({
          studentId: "student-2",
          recommendedOutcome: "GRADUATE",
          status: "READY",
          decision: "GRADUATE",
        }),
      ]),
    );
    expect(result.run.id).toBeDefined();
    expect(result.totals).toMatchObject({
      eligible: 2,
      notStarted: 1,
      needsAction: 1,
      ready: 1,
    });
    expect(result.grades).toHaveLength(2);
  });

  it("snapshots at least 2,000 candidates without attendance dependencies or per-row persistence calls", async () => {
    const ctx = buildContext();
    const sourceCandidates = Array.from({ length: 2_000 }, (_, index) => ({
      schoolYearEnrollment: {
        id: `sye-${index}`,
        studentId: `student-${index}`,
        gradeLevelId: index < 1_200 ? "grade-1" : "grade-2",
        gradeLevel: { order: index < 1_200 ? 1 : 2 },
      },
      activeEnrollment:
        index < 1_200
          ? { id: `enrollment-${index}`, classId: "class-oversized" }
          : null,
    }));
    ctx.lifecycleRepository.findOpenSourceCandidates.mockResolvedValue(
      sourceCandidates,
    );
    const useCase = new CreateOrResumeSchoolYearLifecycleRunUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.gradeLevelRepository,
    );

    await useCase.execute(
      {
        campusId: CAMPUS_ID,
        sourceSchoolYearId: SOURCE_YEAR_ID,
        targetSchoolYearId: TARGET_YEAR_ID,
        sourceClosureDate: sourceSchoolYear.endDate,
        targetEnrollmentDate: targetSchoolYear.startDate,
      },
      actor,
    );

    const [, candidates] =
      ctx.lifecycleRepository.findOrCreateRun.mock.calls[0];
    expect(candidates).toHaveLength(2_000);
    expect(candidates.slice(0, 1_200)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ recommendedOutcome: "PROMOTE" }),
      ]),
    );
    expect(candidates.slice(1_200)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recommendedOutcome: "GRADUATE",
          decision: "GRADUATE",
        }),
      ]),
    );
    expect(ctx.lifecycleRepository.findOrCreateRun).toHaveBeenCalledTimes(1);
  });

  it("returns the competing active run identity instead of creating another", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.findActiveRun.mockResolvedValue(
      makeRun({ id: RUN_ID, version: 4 }),
    );
    const useCase = new CreateOrResumeSchoolYearLifecycleRunUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.gradeLevelRepository,
    );

    const result = await useCase.execute(
      {
        campusId: CAMPUS_ID,
        sourceSchoolYearId: SOURCE_YEAR_ID,
        targetSchoolYearId: TARGET_YEAR_ID,
        sourceClosureDate: sourceSchoolYear.endDate,
        targetEnrollmentDate: targetSchoolYear.startDate,
      },
      actor,
    );

    expect(result.run).toMatchObject({ id: RUN_ID, version: 4 });
    expect(
      ctx.lifecycleRepository.findOpenSourceCandidates,
    ).not.toHaveBeenCalled();
    expect(ctx.lifecycleRepository.findOrCreateRun).not.toHaveBeenCalled();
  });

  it("hides a cross-campus year behind a stable invalid setup response", async () => {
    const ctx = buildContext();
    ctx.schoolYearRepository.findById.mockImplementation(async (id) =>
      id === SOURCE_YEAR_ID
        ? sourceSchoolYear
        : { ...targetSchoolYear, campusId: "other-campus" },
    );
    const useCase = new CreateOrResumeSchoolYearLifecycleRunUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
      ctx.gradeLevelRepository,
    );

    await expect(
      useCase.execute(
        {
          campusId: CAMPUS_ID,
          sourceSchoolYearId: SOURCE_YEAR_ID,
          targetSchoolYearId: TARGET_YEAR_ID,
          sourceClosureDate: sourceSchoolYear.endDate,
          targetEnrollmentDate: targetSchoolYear.startDate,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ctx.lifecycleRepository.findOrCreateRun).not.toHaveBeenCalled();
  });
});

describe("UpdateSchoolYearLifecycleRunSetupUseCase", () => {
  it("uses expectedVersion and atomically invalidates previews", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.updateRunVersioned.mockResolvedValue(
      makeRun({ version: 2, updatedByUserId: ACTOR_ID }),
    );
    const useCase = new UpdateSchoolYearLifecycleRunSetupUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
    );

    const result = await useCase.execute(
      {
        lifecycleRunId: RUN_ID,
        campusId: CAMPUS_ID,
        targetSchoolYearId: TARGET_YEAR_ID,
        sourceClosureDate: sourceSchoolYear.endDate,
        targetEnrollmentDate: targetSchoolYear.startDate,
        expectedVersion: 1,
      },
      actor,
    );

    expect(ctx.lifecycleRepository.updateRunVersioned).toHaveBeenCalledWith(
      expect.objectContaining({
        id: RUN_ID,
        expectedVersion: 1,
        invalidatePreviews: true,
      }),
    );
    expect(result.run.version).toBe(2);
  });

  it("returns SETUP_LOCKED after the first successful commit", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.findRunById.mockResolvedValue(
      makeRun({ firstCommittedAt: new Date() }),
    );
    const useCase = new UpdateSchoolYearLifecycleRunSetupUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
    );

    await expect(
      useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          targetSchoolYearId: TARGET_YEAR_ID,
          sourceClosureDate: sourceSchoolYear.endDate,
          targetEnrollmentDate: targetSchoolYear.startDate,
          expectedVersion: 1,
        },
        actor,
      ),
    ).rejects.toThrow("SETUP_LOCKED");
    expect(ctx.lifecycleRepository.updateRunVersioned).not.toHaveBeenCalled();
  });
});

describe("CancelSchoolYearLifecycleRunUseCase", () => {
  it("rejects cancellation after the first successful commit", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.findRunById.mockResolvedValue(
      makeRun({ firstCommittedAt: new Date() }),
    );
    const useCase = new CancelSchoolYearLifecycleRunUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
    );

    await expect(
      useCase.execute(
        { lifecycleRunId: RUN_ID, campusId: CAMPUS_ID, expectedVersion: 1 },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ctx.lifecycleRepository.updateRunVersioned).not.toHaveBeenCalled();
  });

  it("moves an uncommitted run to CANCELLED and invalidates previews", async () => {
    const ctx = buildContext();
    ctx.lifecycleRepository.updateRunVersioned.mockResolvedValue(
      makeRun({ status: "CANCELLED", version: 2, cancelledAt: new Date() }),
    );
    const useCase = new CancelSchoolYearLifecycleRunUseCase(
      ctx.lifecycleRepository,
      ctx.schoolYearRepository,
    );

    const result = await useCase.execute(
      { lifecycleRunId: RUN_ID, campusId: CAMPUS_ID, expectedVersion: 1 },
      actor,
    );

    expect(ctx.lifecycleRepository.updateRunVersioned).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "CANCELLED",
        expectedVersion: 1,
        invalidatePreviews: true,
      }),
    );
    expect(result.run.status).toBe("CANCELLED");
  });
});
