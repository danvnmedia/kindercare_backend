import {
  absencePeriodsOverlap,
  AbsenceRequest,
  AbsenceRequestStatus,
  AbsenceRequestType,
} from "@/domain/absence-request";

const BASE_PROPS = {
  campusId: "11111111-1111-4111-a111-111111111111",
  studentId: "22222222-2222-4222-a222-222222222222",
  requesterGuardianId: "33333333-3333-4333-a333-333333333333",
  requesterUserId: "44444444-4444-4444-a444-444444444444",
  description: "Medical appointment",
};

describe("AbsenceRequest", () => {
  it("creates a full-day request with date-only semantics and no time range", () => {
    const request = AbsenceRequest.create({
      ...BASE_PROPS,
      absenceType: AbsenceRequestType.FULL_DAY,
      startDate: new Date("2099-07-10T15:30:00.000Z"),
      endDate: new Date("2099-07-12T05:00:00.000Z"),
      startMinute: 540,
      endMinute: 720,
    });

    expect(request.status).toBe(AbsenceRequestStatus.PENDING);
    expect(request.startDate.toISOString()).toBe("2099-07-10T00:00:00.000Z");
    expect(request.endDate.toISOString()).toBe("2099-07-12T00:00:00.000Z");
    expect(request.startTime).toBeNull();
    expect(request.endTime).toBeNull();
  });

  it("requires partial-day requests to stay on one date with end time after start time", () => {
    expect(() =>
      AbsenceRequest.create({
        ...BASE_PROPS,
        absenceType: AbsenceRequestType.PARTIAL_DAY,
        startDate: new Date("2099-07-10T00:00:00.000Z"),
        endDate: new Date("2099-07-11T00:00:00.000Z"),
        startMinute: 540,
        endMinute: 720,
      }),
    ).toThrow(
      "Partial-day absence requests must start and end on the same date",
    );

    expect(() =>
      AbsenceRequest.create({
        ...BASE_PROPS,
        absenceType: AbsenceRequestType.PARTIAL_DAY,
        startDate: new Date("2099-07-10T00:00:00.000Z"),
        endDate: new Date("2099-07-10T00:00:00.000Z"),
        startMinute: 720,
        endMinute: 540,
      }),
    ).toThrow("End time must be after start time");
  });

  it("detects full-day and partial-day overlaps while allowing adjacent partial ranges", () => {
    const fullDay = {
      absenceType: AbsenceRequestType.FULL_DAY,
      startDate: new Date("2099-07-10T00:00:00.000Z"),
      endDate: new Date("2099-07-10T00:00:00.000Z"),
      startMinute: null,
      endMinute: null,
    };
    const morning = {
      absenceType: AbsenceRequestType.PARTIAL_DAY,
      startDate: new Date("2099-07-10T00:00:00.000Z"),
      endDate: new Date("2099-07-10T00:00:00.000Z"),
      startMinute: 540,
      endMinute: 720,
    };
    const afternoon = {
      ...morning,
      startMinute: 720,
      endMinute: 900,
    };

    expect(absencePeriodsOverlap(fullDay, morning)).toBe(true);
    expect(absencePeriodsOverlap(morning, afternoon)).toBe(false);
  });

  it("reviews a pending request once and rejects later review attempts", () => {
    const request = AbsenceRequest.create({
      ...BASE_PROPS,
      absenceType: AbsenceRequestType.PARTIAL_DAY,
      startDate: new Date("2099-07-10T00:00:00.000Z"),
      endDate: new Date("2099-07-10T00:00:00.000Z"),
      startMinute: 540,
      endMinute: 720,
    });

    request.review(
      AbsenceRequestStatus.APPROVED,
      "55555555-5555-4555-a555-555555555555",
      "Approved",
    );

    expect(request.status).toBe(AbsenceRequestStatus.APPROVED);
    expect(request.reviewedById).toBe("55555555-5555-4555-a555-555555555555");
    expect(request.reviewedAt).toBeInstanceOf(Date);
    expect(request.reviewNote).toBe("Approved");
    expect(() =>
      request.review(
        AbsenceRequestStatus.DENIED,
        "66666666-6666-4666-a666-666666666666",
      ),
    ).toThrow("Only pending absence requests can be reviewed");
  });
});
