import { SchoolYearLifecycleRun } from "../../school-year-lifecycle";
import { ExpireInactiveSchoolYearLifecycleRunsUseCase } from "./expire-inactive-school-year-lifecycle-runs.use-case";

const NOW = new Date("2026-07-10T12:00:00.000Z");
const RUN: SchoolYearLifecycleRun = {
  id: "22222222-2222-4222-a222-222222222222",
  campusId: "11111111-1111-4111-a111-111111111111",
  sourceSchoolYearId: "33333333-3333-4333-a333-333333333333",
  targetSchoolYearId: "44444444-4444-4444-a444-444444444444",
  sourceClosureDate: new Date("2026-06-30T00:00:00.000Z"),
  targetEnrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
  status: "DRAFT",
  version: 4,
  createdByUserId: "55555555-5555-4555-a555-555555555555",
  updatedByUserId: null,
  firstCommittedAt: null,
  completedAt: null,
  cancelledAt: null,
  expiredAt: null,
  retentionExpiresAt: null,
  retentionPolicySource: null,
  legalHold: false,
  lastActivityAt: new Date("2026-04-10T11:59:59.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-04-10T11:59:59.000Z"),
};

describe("ExpireInactiveSchoolYearLifecycleRunsUseCase", () => {
  it("expires an inactive uncommitted run and attaches the campus retention policy", async () => {
    const lifecycleRepository = {
      findInactiveUncommittedRuns: jest.fn().mockResolvedValue([RUN]),
      expireInactiveRun: jest.fn().mockImplementation(async (input) => ({
        ...RUN,
        status: "EXPIRED",
        expiredAt: input.expiredAt,
      })),
    } as any;
    const historicalRecordRepository = {
      findRetentionPolicy: jest.fn().mockResolvedValue({
        policySource: "campus-policy-v1",
        retentionDays: 365,
      }),
    } as any;
    const useCase = new ExpireInactiveSchoolYearLifecycleRunsUseCase(
      lifecycleRepository,
      historicalRecordRepository,
    );

    await expect(useCase.execute(NOW)).resolves.toEqual({
      scannedCount: 1,
      expiredCount: 1,
      skippedCount: 0,
      expiredRunIds: [RUN.id],
    });
    expect(
      lifecycleRepository.findInactiveUncommittedRuns,
    ).toHaveBeenCalledWith(new Date("2026-04-11T12:00:00.000Z"), 200);
    expect(lifecycleRepository.expireInactiveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleRunId: RUN.id,
        expectedVersion: 4,
        retention: {
          retentionExpiresAt: new Date("2027-07-10T12:00:00.000Z"),
          retentionPolicySource: "campus-policy-v1",
        },
        audit: expect.objectContaining({
          actorId: RUN.createdByUserId,
          action: "EXPIRE_SCHOOL_YEAR_LIFECYCLE_RUN",
        }),
      }),
    );
  });

  it("reports a race-lost run as skipped without forcing expiration", async () => {
    const lifecycleRepository = {
      findInactiveUncommittedRuns: jest.fn().mockResolvedValue([RUN]),
      expireInactiveRun: jest.fn().mockResolvedValue(null),
    } as any;
    const useCase = new ExpireInactiveSchoolYearLifecycleRunsUseCase(
      lifecycleRepository,
      { findRetentionPolicy: jest.fn().mockResolvedValue(null) } as any,
    );

    await expect(useCase.execute(NOW, 10)).resolves.toEqual({
      scannedCount: 1,
      expiredCount: 0,
      skippedCount: 1,
      expiredRunIds: [],
    });
  });
});
