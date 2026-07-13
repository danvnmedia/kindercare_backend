import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import {
  PreviewSchoolYearLifecycleRunRequest,
  SchoolYearLifecyclePreviewRequest,
} from "./school-year-lifecycle.request";

const SOURCE_YEAR_ID = "11111111-1111-4111-a111-111111111111";
const TARGET_YEAR_ID = "22222222-2222-4222-a222-222222222222";
const CANDIDATE_ID = "33333333-3333-4333-a333-333333333333";

describe("school-year lifecycle preview request compatibility", () => {
  it("keeps the legacy explicit-row contract while rejecting unsafe empty expansion", async () => {
    const empty = plainToInstance(SchoolYearLifecyclePreviewRequest, {
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: "2026-06-30",
      targetEnrollmentDate: "2026-09-01",
      rows: [],
    });
    const explicit = plainToInstance(SchoolYearLifecyclePreviewRequest, {
      sourceSchoolYearId: SOURCE_YEAR_ID,
      targetSchoolYearId: TARGET_YEAR_ID,
      sourceClosureDate: "2026-06-30",
      targetEnrollmentDate: "2026-09-01",
      rows: [{ studentId: CANDIDATE_ID, outcome: "SKIP" }],
    });

    const emptyErrors = await validate(empty);
    expect(
      emptyErrors.find((error) => error.property === "rows")?.constraints,
    ).toMatchObject({ arrayMinSize: "EXPLICIT_ROWS_REQUIRED" });
    await expect(validate(explicit)).resolves.toHaveLength(0);
  });

  it("rejects an empty explicit candidate scope in the new run API", async () => {
    const request = plainToInstance(PreviewSchoolYearLifecycleRunRequest, {
      expectedVersion: 3,
      scope: { type: "STUDENTS", candidateIds: [] },
    });

    const errors = await validate(request);
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: "scope",
          children: expect.arrayContaining([
            expect.objectContaining({
              property: "candidateIds",
              constraints: expect.objectContaining({
                arrayMinSize: expect.any(String),
              }),
            }),
          ]),
        }),
      ]),
    );
  });
});
