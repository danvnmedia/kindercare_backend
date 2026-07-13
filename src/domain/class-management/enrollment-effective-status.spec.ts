import {
  deriveEnrollmentEffectiveStatus,
  toUtcDateOnly,
} from "./enrollment-effective-status";
import { EnrollmentCancellationReason } from "./enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "./enums/enrollment-effective-status.enum";

describe("enrollment effective status", () => {
  it("exposes the locked status and cancellation reason vocabularies", () => {
    expect(Object.values(EnrollmentEffectiveStatus)).toEqual([
      "UPCOMING",
      "ACTIVE",
      "CLOSED",
      "CANCELLED",
    ]);
    expect(Object.values(EnrollmentCancellationReason)).toEqual([
      "FAMILY_REQUEST",
      "CHANGED_SCHOOL",
      "DUPLICATE_REGISTRATION",
      "DATA_ENTRY_ERROR",
      "OTHER",
    ]);
  });

  it.each([
    {
      name: "upcoming before the start date",
      referenceDate: new Date("2026-08-31T23:59:59.999Z"),
      endDate: null,
      cancelledAt: null,
      expected: EnrollmentEffectiveStatus.UPCOMING,
    },
    {
      name: "active on the start date",
      referenceDate: new Date("2026-09-01T23:59:59.999Z"),
      endDate: null,
      cancelledAt: null,
      expected: EnrollmentEffectiveStatus.ACTIVE,
    },
    {
      name: "active on an inclusive end date",
      referenceDate: new Date("2026-09-30T23:59:59.999Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      cancelledAt: null,
      expected: EnrollmentEffectiveStatus.ACTIVE,
    },
    {
      name: "closed on the day after the end date",
      referenceDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      cancelledAt: null,
      expected: EnrollmentEffectiveStatus.CLOSED,
    },
    {
      name: "cancelled takes precedence over every calendar state",
      referenceDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-09-30T00:00:00.000Z"),
      cancelledAt: new Date("2026-07-11T15:00:00.000Z"),
      expected: EnrollmentEffectiveStatus.CANCELLED,
    },
  ])("derives $name", ({ referenceDate, endDate, cancelledAt, expected }) => {
    expect(
      deriveEnrollmentEffectiveStatus({
        enrollmentDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate,
        cancelledAt,
        referenceDate,
      }),
    ).toBe(expected);
  });

  it("normalizes the authoritative boundary to the UTC calendar date", () => {
    expect(toUtcDateOnly(new Date("2026-09-01T00:30:00+14:00"))).toEqual(
      new Date("2026-08-31T00:00:00.000Z"),
    );
  });
});
