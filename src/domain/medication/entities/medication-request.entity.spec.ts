import {
  MedicationAdministrationLog,
  MedicationAdministrationOccurrence,
  MedicationAdministrationOutcome,
  MedicationRequest,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
  MedicationRequestTimelineEntry,
  MedicationReviewAction,
  materializeAdministrationOccurrences,
} from "@/domain/medication";

const baseRequest = {
  campusId: "11111111-1111-4111-a111-111111111111",
  studentId: "22222222-2222-4222-a222-222222222222",
  requesterGuardianId: "33333333-3333-4333-a333-333333333333",
  requesterUserId: "44444444-4444-4444-a444-444444444444",
  startDate: "2026-07-01",
  endDate: "2026-07-05",
  reason: "Fever after doctor visit",
  parentNotes: "Call me if vomiting occurs.",
  items: [
    {
      medicationName: "Antibiotic syrup",
      dosage: "5 ml",
      instructions: "Give after lunch with water.",
      timesOfDay: ["12:30"],
      scheduleNotes: "After lunch only.",
      notes: null,
    },
  ],
};

describe("MedicationRequest", () => {
  it("creates a submitted request with normalized item schedule times", () => {
    const request = MedicationRequest.create({
      ...baseRequest,
      items: [
        {
          ...baseRequest.items[0],
          timesOfDay: ["16:00", "08:30", "08:30"],
        },
      ],
    });

    expect(request.status).toBe(MedicationRequestStatus.SUBMITTED);
    expect(request.completedAt).toBeNull();
    expect(request.expiredAt).toBeNull();
    expect(request.startDate.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(request.endDate.toISOString()).toBe("2026-07-05T00:00:00.000Z");
    expect(request.items).toHaveLength(1);
    expect(request.items[0]).toMatchObject({
      medicationName: "Antibiotic syrup",
      dosage: "5 ml",
      instructions: "Give after lunch with water.",
      timesOfDay: ["08:30", "16:00"],
    });
  });

  it.each([
    [
      MedicationRequestStatus.COMPLETED,
      new Date("2026-07-05T05:30:00.000Z"),
      null,
    ],
    [
      MedicationRequestStatus.EXPIRED,
      null,
      new Date("2026-07-06T04:00:00.000Z"),
    ],
  ])(
    "preserves persisted %s timestamps without deriving status",
    (status, completedAt, expiredAt) => {
      const request = MedicationRequest.create({
        ...baseRequest,
        status,
        completedAt,
        expiredAt,
      });

      expect(request.status).toBe(status);
      expect(request.completedAt).toBe(completedAt);
      expect(request.expiredAt).toBe(expiredAt);
    },
  );

  it("rejects invalid request payload shape", () => {
    expect(() =>
      MedicationRequest.create({ ...baseRequest, endDate: "2026-06-30" }),
    ).toThrow("End date must be on or after start date");

    expect(() =>
      MedicationRequest.create({ ...baseRequest, startDate: "2026-02-31" }),
    ).toThrow("Start date must be a valid date");

    expect(() =>
      MedicationRequest.create({ ...baseRequest, items: [] }),
    ).toThrow("At least one medication item is required");

    expect(() =>
      MedicationRequest.create({
        ...baseRequest,
        items: [{ ...baseRequest.items[0], medicationName: " " }],
      }),
    ).toThrow("Medication name is required");

    expect(() =>
      MedicationRequest.create({
        ...baseRequest,
        items: [{ ...baseRequest.items[0], timesOfDay: ["25:00"] }],
      }),
    ).toThrow("Schedule time must be in HH:mm format");
  });

  it("allows parent cancellation only before terminal states", () => {
    const request = MedicationRequest.create(baseRequest);

    request.cancelByParent("Medication no longer needed.");

    expect(request.status).toBe(MedicationRequestStatus.CANCELLED);
    expect(request.cancelReason).toBe("Medication no longer needed.");
    expect(request.cancelledAt).toBeInstanceOf(Date);

    expect(() => request.cancelByParent()).toThrow(
      "Only submitted or needs-more-info medication requests can be cancelled",
    );
  });

  it("returns needs-more-info responses to submitted review state", () => {
    const request = MedicationRequest.create({
      ...baseRequest,
      status: MedicationRequestStatus.NEEDS_MORE_INFO,
      reviewNote: "Please confirm lunch dosage.",
    });

    request.respondToMoreInfo();

    expect(request.status).toBe(MedicationRequestStatus.SUBMITTED);
    expect(request.reviewNote).toBe("Please confirm lunch dosage.");
  });

  it("rejects parent responses unless more information was requested", () => {
    const request = MedicationRequest.create(baseRequest);

    expect(() => request.respondToMoreInfo()).toThrow(
      "Parent response is allowed only when more information is requested",
    );
  });

  it("reviews submitted requests and materializes approved occurrences", () => {
    const request = MedicationRequest.create({
      ...baseRequest,
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      items: [
        {
          ...baseRequest.items[0],
          timesOfDay: ["08:30", "12:30"],
        },
      ],
    });

    request.reviewByStaff(
      MedicationReviewAction.APPROVE,
      baseRequest.requesterUserId,
      "Approved for this week.",
    );

    const occurrences = materializeAdministrationOccurrences(request);

    expect(request.status).toBe(MedicationRequestStatus.APPROVED);
    expect(request.reviewedByUserId).toBe(baseRequest.requesterUserId);
    expect(request.reviewNote).toBe("Approved for this week.");
    expect(occurrences).toHaveLength(6);
    expect(occurrences.map((occurrence) => occurrence.dueTime)).toEqual([
      "08:30",
      "12:30",
      "08:30",
      "12:30",
      "08:30",
      "12:30",
    ]);
  });

  it("requires a note when staff requests more information", () => {
    const request = MedicationRequest.create(baseRequest);

    expect(() =>
      request.reviewByStaff(
        MedicationReviewAction.NEEDS_MORE_INFO,
        baseRequest.requesterUserId,
      ),
    ).toThrow("Review note is required");
  });

  it("rejects staff review after terminal states", () => {
    const request = MedicationRequest.create({
      ...baseRequest,
      status: MedicationRequestStatus.REJECTED,
    });

    expect(() =>
      request.reviewByStaff(
        MedicationReviewAction.APPROVE,
        baseRequest.requesterUserId,
      ),
    ).toThrow("Only submitted medication requests can be reviewed");
  });

  it("applies terminal transitions with distinct effective and write instants", () => {
    const effectiveAt = new Date("2026-07-05T12:30:00.000Z");
    const transitionedAt = new Date("2026-07-05T12:35:00.000Z");
    const approved = MedicationRequest.create({
      ...baseRequest,
      status: MedicationRequestStatus.APPROVED,
    });
    const submitted = MedicationRequest.create(baseRequest);

    approved.completeAt(effectiveAt, transitionedAt);
    submitted.expireAt(effectiveAt, transitionedAt);

    expect(approved).toMatchObject({
      status: MedicationRequestStatus.COMPLETED,
      completedAt: effectiveAt,
      updatedAt: transitionedAt,
    });
    expect(submitted).toMatchObject({
      status: MedicationRequestStatus.EXPIRED,
      expiredAt: effectiveAt,
      updatedAt: transitionedAt,
    });
    expect(() => approved.completeAt(effectiveAt)).toThrow(
      "Only approved medication requests can be completed",
    );
    expect(() => submitted.expireAt(effectiveAt)).toThrow(
      "Only submitted or needs-more-info medication requests can expire",
    );
  });
});

describe("MedicationRequestTimelineEntry", () => {
  it("creates a guardian timeline entry with stable actor/action fields", () => {
    const entry = MedicationRequestTimelineEntry.create({
      requestId: "55555555-5555-4555-a555-555555555555",
      campusId: baseRequest.campusId,
      actorType: MedicationRequestTimelineActorType.GUARDIAN,
      actorUserId: baseRequest.requesterUserId,
      actorGuardianId: baseRequest.requesterGuardianId,
      action: MedicationRequestTimelineAction.PARENT_RESPONDED,
      note: "Doctor confirmed dosage.",
    });

    expect(entry.actorType).toBe(MedicationRequestTimelineActorType.GUARDIAN);
    expect(entry.actorGuardianId).toBe(baseRequest.requesterGuardianId);
    expect(entry.action).toBe(MedicationRequestTimelineAction.PARENT_RESPONDED);
    expect(entry.note).toBe("Doctor confirmed dosage.");
  });

  it("requires a guardian ID for guardian timeline entries", () => {
    expect(() =>
      MedicationRequestTimelineEntry.create({
        requestId: "55555555-5555-4555-a555-555555555555",
        campusId: baseRequest.campusId,
        actorType: MedicationRequestTimelineActorType.GUARDIAN,
        action: MedicationRequestTimelineAction.SUBMITTED,
      }),
    ).toThrow("Actor guardian ID is required for guardian timeline entry");
  });
});

describe("MedicationAdministrationOccurrence and log foundations", () => {
  it("updates the occurrence latest summary from an append-only log", () => {
    const occurrence = MedicationAdministrationOccurrence.create({
      requestId: "55555555-5555-4555-a555-555555555555",
      medicationItemId: "66666666-6666-4666-a666-666666666666",
      campusId: baseRequest.campusId,
      studentId: baseRequest.studentId,
      dueDate: "2026-07-01",
      dueMinute: 750,
    });
    const log = MedicationAdministrationLog.create({
      occurrenceId: occurrence.id,
      outcome: MedicationAdministrationOutcome.GIVEN,
      recordedByUserId: baseRequest.requesterUserId,
      actualMinute: 755,
      note: null,
    });

    occurrence.applyLatestLog(log);

    expect(occurrence.latestOutcome).toBe(
      MedicationAdministrationOutcome.GIVEN,
    );
    expect(occurrence.latestLogId).toBe(log.id);
    expect(occurrence.latestRecordedByUserId).toBe(baseRequest.requesterUserId);
    expect(log.actualTime).toBe("12:35");
  });

  it("requires notes for non-given outcomes and corrections", () => {
    expect(() =>
      MedicationAdministrationLog.create({
        occurrenceId: "77777777-7777-4777-a777-777777777777",
        outcome: MedicationAdministrationOutcome.SKIPPED,
        recordedByUserId: baseRequest.requesterUserId,
      }),
    ).toThrow("A note is required for non-given outcomes");

    expect(() =>
      MedicationAdministrationLog.create({
        occurrenceId: "77777777-7777-4777-a777-777777777777",
        outcome: MedicationAdministrationOutcome.GIVEN,
        recordedByUserId: baseRequest.requesterUserId,
        note: "Corrected duplicate entry",
        correctionOfLogId: " ",
      }),
    ).toThrow("Correction log ID is required");

    expect(() =>
      MedicationAdministrationLog.create({
        occurrenceId: "77777777-7777-4777-a777-777777777777",
        outcome: MedicationAdministrationOutcome.GIVEN,
        recordedByUserId: baseRequest.requesterUserId,
        correctionOfLogId: "88888888-8888-4888-a888-888888888888",
      }),
    ).toThrow("A correction note is required");
  });
});
