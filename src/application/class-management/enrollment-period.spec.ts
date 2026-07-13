import { isEnrollmentPeriodOverlapPersistenceError } from "./enrollment-period";

describe("isEnrollmentPeriodOverlapPersistenceError", () => {
  it("recognizes Enrollment uniqueness and exclusion-constraint races", () => {
    expect(
      isEnrollmentPeriodOverlapPersistenceError({
        code: "P2002",
        meta: {
          modelName: "Enrollment",
          target: "idx_enrollment_unique_uncancelled_start",
        },
      }),
    ).toBe(true);
    expect(isEnrollmentPeriodOverlapPersistenceError({ code: "23P01" })).toBe(
      true,
    );
  });

  it("does not misclassify a SchoolYearEnrollment uniqueness race", () => {
    expect(
      isEnrollmentPeriodOverlapPersistenceError({
        code: "P2002",
        meta: {
          modelName: "SchoolYearEnrollment",
          target: "idx_sye_one_open_per_year",
        },
      }),
    ).toBe(false);
  });
});
