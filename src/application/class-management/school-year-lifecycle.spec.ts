import {
  assertLifecycleDateWithinSchoolYear,
  assertSchoolYearLifecycleSetup,
  buildSchoolYearLifecycleProgress,
  deriveSchoolYearLifecycleRunStatusAfterCommit,
  SchoolYearLifecycleInvariantError,
} from "./school-year-lifecycle";

const sourceSchoolYear = {
  id: "source-year",
  campusId: "campus-1",
  startDate: new Date("2025-09-01T00:00:00.000Z"),
  endDate: new Date("2026-06-30T00:00:00.000Z"),
};

const targetSchoolYear = {
  id: "target-year",
  campusId: "campus-1",
  startDate: new Date("2026-09-01T00:00:00.000Z"),
  endDate: new Date("2027-06-30T00:00:00.000Z"),
};

function expectInvariantCode(
  execute: () => void,
  code: SchoolYearLifecycleInvariantError["code"],
) {
  try {
    execute();
    throw new Error("Expected lifecycle invariant to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(SchoolYearLifecycleInvariantError);
    expect((error as SchoolYearLifecycleInvariantError).code).toBe(code);
  }
}

describe("school-year lifecycle setup invariants", () => {
  it("accepts campus-owned adjacent school years and in-range date-only values", () => {
    expect(() =>
      assertSchoolYearLifecycleSetup({
        campusId: "campus-1",
        sourceSchoolYear,
        targetSchoolYear,
        sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
        targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        nextSchoolYearId: "target-year",
      }),
    ).not.toThrow();
  });

  it("rejects an identical source and target year", () => {
    expectInvariantCode(
      () =>
        assertSchoolYearLifecycleSetup({
          campusId: "campus-1",
          sourceSchoolYear,
          targetSchoolYear: sourceSchoolYear,
          sourceClosureDate: sourceSchoolYear.endDate,
          targetEnrollmentDate: sourceSchoolYear.startDate,
          nextSchoolYearId: sourceSchoolYear.id,
        }),
      "IDENTICAL_SCHOOL_YEARS",
    );
  });

  it("rejects non-adjacent school years even when their dates do not overlap", () => {
    expectInvariantCode(
      () =>
        assertSchoolYearLifecycleSetup({
          campusId: "campus-1",
          sourceSchoolYear,
          targetSchoolYear,
          sourceClosureDate: sourceSchoolYear.endDate,
          targetEnrollmentDate: targetSchoolYear.startDate,
          nextSchoolYearId: "another-year",
        }),
      "NON_ADJACENT_SCHOOL_YEARS",
    );
  });

  it("rejects cross-campus school years without revealing them as valid setup", () => {
    expectInvariantCode(
      () =>
        assertSchoolYearLifecycleSetup({
          campusId: "campus-1",
          sourceSchoolYear,
          targetSchoolYear: { ...targetSchoolYear, campusId: "campus-2" },
          sourceClosureDate: sourceSchoolYear.endDate,
          targetEnrollmentDate: targetSchoolYear.startDate,
          nextSchoolYearId: targetSchoolYear.id,
        }),
      "SCHOOL_YEAR_CAMPUS_MISMATCH",
    );
  });

  it("rejects invalid and out-of-range dates with a stable code", () => {
    expectInvariantCode(
      () =>
        assertLifecycleDateWithinSchoolYear(
          new Date("invalid"),
          sourceSchoolYear,
        ),
      "INVALID_DATE",
    );
    expectInvariantCode(
      () =>
        assertLifecycleDateWithinSchoolYear(
          new Date("2026-07-01T00:00:00.000Z"),
          sourceSchoolYear,
        ),
      "INVALID_DATE",
    );
  });
});

describe("school-year lifecycle progress", () => {
  it("excludes no-longer-eligible rows from completion denominators", () => {
    const { totals } = buildSchoolYearLifecycleProgress([
      {
        sourceGradeLevelId: "grade-1",
        sourceGradeLevelName: "Grade 1",
        sourceGradeLevelOrder: 1,
        sourceClassId: null,
        sourceClassName: null,
        status: "COMMITTED",
        decision: "PROMOTE",
        targetClassId: "class-2",
        count: 3,
      },
      {
        sourceGradeLevelId: "grade-1",
        sourceGradeLevelName: "Grade 1",
        sourceGradeLevelOrder: 1,
        sourceClassId: null,
        sourceClassName: null,
        status: "NO_LONGER_ELIGIBLE",
        decision: null,
        targetClassId: null,
        count: 2,
      },
    ]);

    expect(totals).toMatchObject({
      eligible: 3,
      complete: 3,
      noLongerEligible: 2,
      completionPercent: 100,
    });
  });

  it("derives completed, partial, and reconciliation run states", () => {
    expect(
      deriveSchoolYearLifecycleRunStatusAfterCommit({
        eligibleCount: 4,
        completeCount: 4,
        hasPriorSuccessfulCommit: false,
        successCount: 0,
        alreadyAppliedCount: 0,
        failedCount: 0,
      }),
    ).toBe("COMPLETED");
    expect(
      deriveSchoolYearLifecycleRunStatusAfterCommit({
        eligibleCount: 4,
        completeCount: 2,
        hasPriorSuccessfulCommit: false,
        successCount: 1,
        alreadyAppliedCount: 0,
        failedCount: 1,
      }),
    ).toBe("PARTIALLY_COMMITTED");
    expect(
      deriveSchoolYearLifecycleRunStatusAfterCommit({
        eligibleCount: 4,
        completeCount: 0,
        hasPriorSuccessfulCommit: false,
        successCount: 0,
        alreadyAppliedCount: 0,
        failedCount: 4,
      }),
    ).toBe("NEEDS_RECONCILIATION");
  });
});
