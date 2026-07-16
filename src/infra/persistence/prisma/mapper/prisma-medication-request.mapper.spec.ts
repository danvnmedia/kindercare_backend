import {
  MedicationAdministrationOutcome,
  MedicationRequestStatus,
} from "@/domain/medication";

import {
  PrismaMedicationRequestMapper,
  PrismaMedicationRequestWithRelations,
} from "./prisma-medication-request.mapper";

const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "99999999-9999-4999-a999-999999999999";
const STUDENT_ID = "22222222-2222-4222-a222-222222222222";
const GUARDIAN_ID = "33333333-3333-4333-a333-333333333333";
const USER_ID = "44444444-4444-4444-a444-444444444444";
const REQUEST_ID = "55555555-5555-4555-a555-555555555555";
const ITEM_ID = "66666666-6666-4666-a666-666666666666";
const OCCURRENCE_ID = "77777777-7777-4777-a777-777777777777";
const LOG_ID = "88888888-8888-4888-a888-888888888888";
const NOW = new Date("2099-07-01T05:40:00.000Z");

describe("PrismaMedicationRequestMapper", () => {
  it("maps reviewer and recorder summaries from campus user profiles", () => {
    const request = PrismaMedicationRequestMapper.toDomain(
      medicationRequestRow({
        reviewedByUser: userRow({
          staffs: [
            {
              campusId: OTHER_CAMPUS_ID,
              fullName: "Other Campus Nurse",
              email: "other-nurse@example.com",
            },
            {
              campusId: CAMPUS_ID,
              fullName: "Avery Nurse",
              email: "avery.nurse@example.com",
            },
          ],
        }),
        occurrences: [
          {
            id: OCCURRENCE_ID,
            requestId: REQUEST_ID,
            medicationItemId: ITEM_ID,
            campusId: CAMPUS_ID,
            studentId: STUDENT_ID,
            dueDate: new Date("2099-07-01T00:00:00.000Z"),
            dueMinute: 750,
            latestOutcome: MedicationAdministrationOutcome.GIVEN,
            latestLogId: LOG_ID,
            latestRecordedAt: NOW,
            latestRecordedByUserId: USER_ID,
            latestNote: null,
            createdAt: NOW,
            updatedAt: NOW,
            logs: [
              {
                id: LOG_ID,
                occurrenceId: OCCURRENCE_ID,
                outcome: MedicationAdministrationOutcome.GIVEN,
                recordedByUserId: USER_ID,
                recordedAt: NOW,
                actualMinute: 755,
                note: null,
                correctionOfLogId: null,
                createdAt: NOW,
                updatedAt: NOW,
                recordedBy: userRow({
                  staffs: [
                    {
                      campusId: CAMPUS_ID,
                      fullName: "Avery Nurse",
                      email: "avery.nurse@example.com",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    );

    expect(request.reviewedByUser).toEqual({
      id: USER_ID,
      name: "Avery Nurse",
      email: "avery.nurse@example.com",
    });
    expect(request.occurrences[0].logs[0].recordedByUser).toEqual({
      id: USER_ID,
      name: "Avery Nurse",
      email: "avery.nurse@example.com",
    });
  });

  it("falls back to auth identity when no profile summary is available", () => {
    const request = PrismaMedicationRequestMapper.toDomain(
      medicationRequestRow({
        reviewedByUser: userRow({ staffs: [], guardians: [] }),
      }),
    );

    expect(request.reviewedByUser).toEqual({
      id: USER_ID,
      name: "staff_clerk_uid",
      email: null,
    });
  });

  it("does not use another campus profile as a summary fallback", () => {
    const request = PrismaMedicationRequestMapper.toDomain(
      medicationRequestRow({
        reviewedByUser: userRow({
          staffs: [
            {
              campusId: OTHER_CAMPUS_ID,
              fullName: "Other Campus Nurse",
              email: "other-nurse@example.com",
            },
          ],
        }),
      }),
    );

    expect(request.reviewedByUser).toEqual({
      id: USER_ID,
      name: "staff_clerk_uid",
      email: null,
    });
  });

  it("round-trips terminal timestamps through domain and persistence shapes", () => {
    const completedAt = new Date("2099-07-05T05:30:00.000Z");
    const expiredAt = new Date("2099-07-06T04:00:00.000Z");
    const completedRequest = PrismaMedicationRequestMapper.toDomain(
      medicationRequestRow({
        status: MedicationRequestStatus.COMPLETED,
        completedAt,
      }),
    );
    const expiredRequest = PrismaMedicationRequestMapper.toDomain(
      medicationRequestRow({
        status: MedicationRequestStatus.EXPIRED,
        expiredAt,
      }),
    );

    expect(completedRequest.completedAt).toBe(completedAt);
    expect(completedRequest.expiredAt).toBeNull();
    expect(expiredRequest.completedAt).toBeNull();
    expect(expiredRequest.expiredAt).toBe(expiredAt);
    expect(
      PrismaMedicationRequestMapper.toPrismaCreate(completedRequest),
    ).toMatchObject({ completedAt, expiredAt: null });
    expect(
      PrismaMedicationRequestMapper.toPrismaUpdate(expiredRequest),
    ).toMatchObject({ completedAt: null, expiredAt });
    expect(
      PrismaMedicationRequestMapper.toPrismaUpdateMany(completedRequest),
    ).toMatchObject({ completedAt, expiredAt: null });
  });
});

function medicationRequestRow(
  overrides: Partial<PrismaMedicationRequestWithRelations> = {},
): PrismaMedicationRequestWithRelations {
  return {
    id: REQUEST_ID,
    campusId: CAMPUS_ID,
    studentId: STUDENT_ID,
    requesterGuardianId: GUARDIAN_ID,
    requesterUserId: USER_ID,
    status: MedicationRequestStatus.APPROVED,
    startDate: new Date("2099-07-01T00:00:00.000Z"),
    endDate: new Date("2099-07-05T00:00:00.000Z"),
    reason: "Medication during school day.",
    parentNotes: null,
    reviewedByUserId: USER_ID,
    reviewedAt: NOW,
    reviewNote: "Approved.",
    cancelledAt: null,
    cancelReason: null,
    completedAt: null,
    expiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    items: [
      {
        id: ITEM_ID,
        requestId: REQUEST_ID,
        medicationName: "Antibiotic syrup",
        dosage: "5 ml",
        instructions: "Give after lunch with water.",
        timesOfDay: ["12:30"],
        scheduleNotes: null,
        notes: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    student: null,
    requesterGuardian: null,
    reviewedByUser: null,
    timelineEntries: [],
    occurrences: [],
    ...overrides,
  } as unknown as PrismaMedicationRequestWithRelations;
}

function userRow(
  overrides: Partial<
    NonNullable<PrismaMedicationRequestWithRelations["reviewedByUser"]>
  > = {},
): NonNullable<PrismaMedicationRequestWithRelations["reviewedByUser"]> {
  return {
    id: USER_ID,
    clerkUid: "staff_clerk_uid",
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    staffs: [],
    guardians: [],
    ...overrides,
  };
}
