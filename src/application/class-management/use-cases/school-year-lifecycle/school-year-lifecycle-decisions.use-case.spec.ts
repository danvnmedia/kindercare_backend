import { ConflictException } from "@nestjs/common";

import { createUser } from "@/test-utils/entity-factories";

import { BulkSaveSchoolYearLifecycleDecisionsUseCase } from "./bulk-save-school-year-lifecycle-decisions.use-case";
import { SaveSchoolYearLifecycleDecisionsUseCase } from "./save-school-year-lifecycle-decisions.use-case";
import { validateSchoolYearLifecycleDecisions } from "./school-year-lifecycle-decision-validator";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const RUN_ID = "22222222-2222-4222-a222-222222222222";
const TARGET_YEAR_ID = "33333333-3333-4333-a333-333333333333";
const ACTOR_ID = "44444444-4444-4444-a444-444444444444";

function candidate(
  id: string,
  sourceGradeLevelId = "grade-1",
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    lifecycleRunId: RUN_ID,
    campusId: CAMPUS_ID,
    studentId: `student-${id}`,
    sourceSchoolYearEnrollmentId: `sye-${id}`,
    sourceEnrollmentId: null,
    sourceGradeLevelId,
    sourceClassId: null,
    status: "NOT_STARTED",
    recommendedOutcome: "PROMOTE",
    decision: null,
    targetGradeLevelId: null,
    targetClassId: null,
    decisionNote: null,
    conflictCode: null,
    message: null,
    decisionUpdatedByUserId: null,
    decisionUpdatedAt: null,
    rowVersion: 1,
    committedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

const gradeLevels = [
  { id: "grade-1", order: 1 },
  { id: "grade-2", order: 2 },
] as any;
const retainClass = {
  id: "retain-class",
  campusId: CAMPUS_ID,
  schoolYearId: TARGET_YEAR_ID,
  gradeLevelId: "grade-1",
} as any;
const promoteClass = {
  id: "promote-class",
  campusId: CAMPUS_ID,
  schoolYearId: TARGET_YEAR_ID,
  gradeLevelId: "grade-2",
} as any;

describe("validateSchoolYearLifecycleDecisions", () => {
  it("enforces grade-safe promote, retain, graduate, and mutation-free skip rules", () => {
    const lower = candidate("lower");
    const highest = candidate("highest", "grade-2");
    const result = validateSchoolYearLifecycleDecisions({
      campusId: CAMPUS_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      candidates: [lower, highest],
      targetClasses: [retainClass, promoteClass],
      gradeLevels,
      decisions: [
        { candidateId: lower.id, outcome: "GRADUATE" },
        { candidateId: highest.id, outcome: "GRADUATE" },
      ],
    });

    expect(result.rejected).toEqual([
      expect.objectContaining({
        candidateId: lower.id,
        code: "GRADUATION_NOT_ALLOWED",
      }),
    ]);
    expect(result.accepted).toEqual([
      expect.objectContaining({
        candidateId: highest.id,
        decision: "GRADUATE",
        targetClassId: null,
      }),
    ]);

    const targetResults = validateSchoolYearLifecycleDecisions({
      campusId: CAMPUS_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      candidates: [lower],
      targetClasses: [retainClass, promoteClass],
      gradeLevels,
      decisions: [
        {
          candidateId: lower.id,
          outcome: "PROMOTE",
          targetClassId: promoteClass.id,
        },
      ],
    });
    expect(targetResults.accepted[0]).toMatchObject({
      decision: "PROMOTE",
      targetGradeLevelId: "grade-2",
      targetClassId: promoteClass.id,
    });

    const invalidSkip = validateSchoolYearLifecycleDecisions({
      campusId: CAMPUS_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      candidates: [lower],
      targetClasses: [promoteClass],
      gradeLevels,
      decisions: [
        {
          candidateId: lower.id,
          outcome: "SKIP",
          targetClassId: promoteClass.id,
        },
      ],
    });
    expect(invalidSkip.rejected[0].code).toBe("INVALID_DECISION");
  });
});

describe("SaveSchoolYearLifecycleDecisionsUseCase", () => {
  it("returns a recoverable 409 when the compare-and-swap loses", async () => {
    const row = candidate("candidate-1");
    const lifecycleRepository = {
      findRunById: jest
        .fn()
        .mockResolvedValueOnce({
          id: RUN_ID,
          campusId: CAMPUS_ID,
          targetSchoolYearId: TARGET_YEAR_ID,
          version: 1,
        })
        .mockResolvedValueOnce({ id: RUN_ID, version: 2 }),
      findCandidatesByIds: jest.fn().mockResolvedValue([row]),
      saveDecisionsVersioned: jest.fn().mockResolvedValue(null),
    } as any;
    const useCase = new SaveSchoolYearLifecycleDecisionsUseCase(
      lifecycleRepository,
      { findByIds: jest.fn().mockResolvedValue([promoteClass]) } as any,
      { findNonArchived: jest.fn().mockResolvedValue(gradeLevels) } as any,
    );

    try {
      await useCase.execute(
        {
          lifecycleRunId: RUN_ID,
          campusId: CAMPUS_ID,
          expectedVersion: 1,
          decisions: [
            {
              candidateId: row.id,
              outcome: "PROMOTE",
              targetClassId: promoteClass.id,
            },
          ],
        },
        createUser({ id: ACTOR_ID }),
      );
      throw new Error("Expected stale version conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: "STALE_RUN_VERSION",
        currentVersion: 2,
        lifecycleRunId: RUN_ID,
        currentRows: [
          expect.objectContaining({ candidateId: row.id, rowVersion: 1 }),
        ],
      });
    }
  });
});

describe("BulkSaveSchoolYearLifecycleDecisionsUseCase", () => {
  it("resolves and updates the complete filtered scope beyond one loaded page", async () => {
    const candidates = Array.from({ length: 700 }, (_, index) =>
      candidate(`candidate-${index}`),
    );
    const lifecycleRepository = {
      findRunById: jest.fn().mockResolvedValue({
        id: RUN_ID,
        campusId: CAMPUS_ID,
        targetSchoolYearId: TARGET_YEAR_ID,
        version: 1,
      }),
      findCandidatesByFilter: jest.fn().mockResolvedValue(candidates),
      saveDecisionsVersioned: jest.fn().mockResolvedValue({ version: 2 }),
    } as any;
    const useCase = new BulkSaveSchoolYearLifecycleDecisionsUseCase(
      lifecycleRepository,
      { findByIds: jest.fn() } as any,
      { findNonArchived: jest.fn().mockResolvedValue(gradeLevels) } as any,
    );

    const result = await useCase.execute(
      {
        lifecycleRunId: RUN_ID,
        campusId: CAMPUS_ID,
        expectedVersion: 1,
        filter: { sourceGradeLevelId: "grade-1" },
        outcome: "SKIP",
      },
      createUser({ id: ACTOR_ID }),
    );

    expect(lifecycleRepository.findCandidatesByFilter).toHaveBeenCalledWith(
      RUN_ID,
      CAMPUS_ID,
      { sourceGradeLevelId: "grade-1" },
    );
    expect(
      lifecycleRepository.saveDecisionsVersioned.mock.calls[0][0].decisions,
    ).toHaveLength(700);
    expect(result).toMatchObject({
      affectedCount: 700,
      rejectedCount: 0,
      version: 2,
    });
  });
});
