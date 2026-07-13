import { createUser } from "@/test-utils/entity-factories";

import { RefreshSchoolYearLifecycleCandidatesUseCase } from "./refresh-school-year-lifecycle-candidates.use-case";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const RUN_ID = "22222222-2222-4222-a222-222222222222";
const SOURCE_YEAR_ID = "33333333-3333-4333-a333-333333333333";
const TARGET_YEAR_ID = "44444444-4444-4444-a444-444444444444";
const ACTOR_ID = "55555555-5555-4555-a555-555555555555";

const run = {
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
  lastActivityAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

function existingCandidate(
  id: string,
  studentId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    lifecycleRunId: RUN_ID,
    campusId: CAMPUS_ID,
    studentId,
    sourceSchoolYearEnrollmentId: `sye-${studentId}`,
    sourceEnrollmentId: `enrollment-${studentId}`,
    sourceGradeLevelId: "grade-1",
    sourceClassId: "class-old",
    status: "READY",
    recommendedOutcome: "PROMOTE",
    decision: "PROMOTE",
    targetGradeLevelId: "grade-2",
    targetClassId: "target-class-2",
    decisionNote: null,
    decisionUpdatedByUserId: ACTOR_ID,
    decisionUpdatedAt: new Date(),
    rowVersion: 1,
    committedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as any;
}

function currentCandidate(
  studentId: string,
  gradeLevelId: string,
  gradeOrder: number,
  classId: string | null,
) {
  return {
    schoolYearEnrollment: {
      id: `current-sye-${studentId}`,
      studentId,
      gradeLevelId,
      gradeLevel: { order: gradeOrder },
    },
    activeEnrollment: classId
      ? { id: `current-enrollment-${studentId}`, classId }
      : null,
  } as any;
}

describe("RefreshSchoolYearLifecycleCandidatesUseCase", () => {
  it("adds, relocates, preserves compatible decisions, clears incompatible assignments, and retains ineligible rows", async () => {
    const existing = [
      existingCandidate("candidate-1", "student-1"),
      existingCandidate("candidate-2", "student-2"),
      existingCandidate("candidate-4", "student-4"),
    ];
    const current = [
      currentCandidate("student-1", "grade-1", 1, "class-new"),
      currentCandidate("student-3", "grade-3", 3, null),
      currentCandidate("student-4", "grade-2", 2, "class-grade-2"),
    ];
    const lifecycleRepository = {
      findRunById: jest.fn().mockResolvedValue(run),
      findOpenSourceCandidates: jest.fn().mockResolvedValue(current),
      findCandidatesByRunId: jest.fn().mockResolvedValue(existing),
      reconcileCandidatesVersioned: jest.fn().mockResolvedValue({
        ...run,
        version: 2,
      }),
      findCandidateAggregates: jest.fn().mockResolvedValue([]),
    } as any;
    const schoolYearRepository = {
      findById: jest.fn(async (id) => ({
        id,
        campusId: CAMPUS_ID,
        name: id === SOURCE_YEAR_ID ? "2025-2026" : "2026-2027",
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2027-06-30T00:00:00.000Z"),
      })),
    } as any;
    const gradeLevelRepository = {
      findNonArchived: jest.fn().mockResolvedValue([
        { id: "grade-1", order: 1 },
        { id: "grade-2", order: 2 },
        { id: "grade-3", order: 3 },
      ]),
    } as any;
    const useCase = new RefreshSchoolYearLifecycleCandidatesUseCase(
      lifecycleRepository,
      schoolYearRepository,
      gradeLevelRepository,
    );

    const result = await useCase.execute(
      { lifecycleRunId: RUN_ID, campusId: CAMPUS_ID, expectedVersion: 1 },
      createUser({ id: ACTOR_ID }),
    );

    const mutation =
      lifecycleRepository.reconcileCandidatesVersioned.mock.calls[0][0];
    expect(mutation.inserts).toEqual([
      expect.objectContaining({
        studentId: "student-3",
        recommendedOutcome: "GRADUATE",
        decision: "GRADUATE",
        status: "READY",
      }),
    ]);
    expect(mutation.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "candidate-1",
          sourceClassId: "class-new",
          status: "NEEDS_REVIEW",
          decision: "PROMOTE",
          targetClassId: "target-class-2",
        }),
        expect.objectContaining({
          id: "candidate-4",
          sourceGradeLevelId: "grade-2",
          status: "NEEDS_REVIEW",
          decision: "PROMOTE",
          targetGradeLevelId: "grade-3",
          targetClassId: null,
        }),
        expect.objectContaining({
          id: "candidate-2",
          status: "NO_LONGER_ELIGIBLE",
        }),
      ]),
    );
    expect(result).toMatchObject({
      addedCount: 1,
      updatedCount: 2,
      noLongerEligibleCount: 1,
    });
    expect(result.run.run.version).toBe(2);
  });
});
