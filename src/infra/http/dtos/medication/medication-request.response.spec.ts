import { instanceToPlain, plainToInstance } from "class-transformer";

import {
  MedicationAdministrationOutcome,
  MedicationRequestStatus,
  MedicationRequestTimelineAction,
  MedicationRequestTimelineActorType,
} from "@/domain/medication";

import {
  MedicationRequestDetailResponse,
  MedicationRequestResponse,
  ParentMedicationRequestDetailResponse,
} from "./medication-request.response";

const ACTIVE_ATTACHMENT_FIELDS = [
  "attachments",
  "attachmentId",
  "attachmentIds",
  "attachmentUploadUrl",
  "attachmentDownloadUrl",
  "uploadUrl",
  "downloadUrl",
  "prescriptionImageId",
  "prescriptionImageUrl",
];

function expectNoActiveAttachmentFields(value: unknown) {
  const serialized = JSON.stringify(value);

  for (const field of ACTIVE_ATTACHMENT_FIELDS) {
    expect(serialized).not.toContain(`"${field}"`);
  }
}

describe("MedicationRequestResponse", () => {
  it("exposes parent-visible review, cancel, and timeline fields", () => {
    const response = plainToInstance(
      MedicationRequestResponse,
      {
        id: "55555555-5555-4555-a555-555555555555",
        campusId: "11111111-1111-4111-a111-111111111111",
        studentId: "22222222-2222-4222-a222-222222222222",
        student: {
          id: "22222222-2222-4222-a222-222222222222",
          fullName: "Ava Nguyen",
          studentCode: "S-0001",
        },
        requesterGuardianId: "33333333-3333-4333-a333-333333333333",
        requesterGuardian: {
          id: "33333333-3333-4333-a333-333333333333",
          fullName: "Linh Nguyen",
          email: "parent@example.com",
          phoneNumber: "+14165550100",
        },
        status: MedicationRequestStatus.NEEDS_MORE_INFO,
        startDate: new Date("2099-07-01T00:00:00.000Z"),
        endDate: new Date("2099-07-05T00:00:00.000Z"),
        reason: "Fever after doctor visit",
        parentNotes: "Call me if vomiting occurs.",
        attachments: [{ id: "must-not-leak" }],
        uploadUrl: "https://example.com/upload",
        downloadUrl: "https://example.com/download",
        prescriptionImageUrl: "https://example.com/prescription.png",
        reviewedAt: new Date("2099-07-01T15:00:00.000Z"),
        reviewNote: "Please confirm lunch dosage.",
        cancelledAt: null,
        cancelReason: null,
        items: [
          {
            id: "66666666-6666-4666-a666-666666666666",
            medicationName: "Antibiotic syrup",
            dosage: "5 ml",
            instructions: "Give after lunch with water.",
            attachmentId: "must-not-leak",
            attachmentDownloadUrl: "https://example.com/item-download",
            timesOfDay: ["12:30"],
            scheduleNotes: "After lunch only.",
            notes: null,
            createdAt: new Date("2099-07-01T14:30:00.000Z"),
            updatedAt: new Date("2099-07-01T14:30:00.000Z"),
          },
        ],
        timelineEntries: [
          {
            id: "77777777-7777-4777-a777-777777777777",
            requestId: "55555555-5555-4555-a555-555555555555",
            campusId: "11111111-1111-4111-a111-111111111111",
            actorType: MedicationRequestTimelineActorType.GUARDIAN,
            actorUserId: "44444444-4444-4444-a444-444444444444",
            actorGuardianId: "33333333-3333-4333-a333-333333333333",
            action: MedicationRequestTimelineAction.PARENT_RESPONDED,
            note: "Doctor confirmed dosage.",
            createdAt: new Date("2099-07-01T15:05:00.000Z"),
            updatedAt: new Date("2099-07-01T15:05:00.000Z"),
          },
        ],
        createdAt: new Date("2099-07-01T14:30:00.000Z"),
        updatedAt: new Date("2099-07-01T15:05:00.000Z"),
        internalOnly: "must not leak",
      },
      { excludeExtraneousValues: true },
    );

    expect(instanceToPlain(response)).toMatchObject({
      startDate: "2099-07-01",
      endDate: "2099-07-05",
      reviewNote: "Please confirm lunch dosage.",
      cancelledAt: null,
      timelineEntries: [
        {
          action: MedicationRequestTimelineAction.PARENT_RESPONDED,
          note: "Doctor confirmed dosage.",
          actorType: MedicationRequestTimelineActorType.GUARDIAN,
        },
      ],
    });
    expect(instanceToPlain(response)).not.toHaveProperty("internalOnly");
    expectNoActiveAttachmentFields(instanceToPlain(response));
  });

  it("base response drops staff-only occurrence and reviewer details", () => {
    const response = plainToInstance(
      MedicationRequestResponse,
      {
        id: "55555555-5555-4555-a555-555555555555",
        campusId: "11111111-1111-4111-a111-111111111111",
        studentId: "22222222-2222-4222-a222-222222222222",
        student: null,
        requesterGuardianId: "33333333-3333-4333-a333-333333333333",
        requesterGuardian: null,
        status: MedicationRequestStatus.APPROVED,
        startDate: new Date("2099-07-01T00:00:00.000Z"),
        endDate: new Date("2099-07-05T00:00:00.000Z"),
        reason: null,
        parentNotes: null,
        attachments: [{ id: "must-not-leak" }],
        attachmentUploadUrl: "https://example.com/upload",
        attachmentDownloadUrl: "https://example.com/download",
        prescriptionImageId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        reviewedAt: new Date("2099-07-01T15:00:00.000Z"),
        reviewedByUser: {
          id: "44444444-4444-4444-a444-444444444444",
          name: "staff_clerk_uid",
          email: null,
        },
        reviewNote: "Approved.",
        cancelledAt: null,
        cancelReason: null,
        items: [],
        timelineEntries: [],
        occurrences: [
          {
            id: "99999999-9999-4999-a999-999999999999",
            logs: [{ id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa" }],
          },
        ],
        createdAt: new Date("2099-07-01T14:30:00.000Z"),
        updatedAt: new Date("2099-07-01T15:05:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response);

    expect(plain).not.toHaveProperty("reviewedByUser");
    expect(plain).not.toHaveProperty("occurrences");
    expectNoActiveAttachmentFields(plain);
  });

  it("exposes staff detail occurrences and append-only administration logs", () => {
    const response = plainToInstance(
      MedicationRequestDetailResponse,
      {
        id: "55555555-5555-4555-a555-555555555555",
        campusId: "11111111-1111-4111-a111-111111111111",
        studentId: "22222222-2222-4222-a222-222222222222",
        student: {
          id: "22222222-2222-4222-a222-222222222222",
          fullName: "Ava Nguyen",
          studentCode: "S-0001",
        },
        requesterGuardianId: "33333333-3333-4333-a333-333333333333",
        requesterGuardian: {
          id: "33333333-3333-4333-a333-333333333333",
          fullName: "Linh Nguyen",
          email: "parent@example.com",
          phoneNumber: "+14165550100",
        },
        status: MedicationRequestStatus.APPROVED,
        startDate: new Date("2099-07-01T00:00:00.000Z"),
        endDate: new Date("2099-07-05T00:00:00.000Z"),
        reason: "Fever after doctor visit",
        parentNotes: "Call me if vomiting occurs.",
        attachments: [{ id: "must-not-leak" }],
        uploadUrl: "https://example.com/upload",
        downloadUrl: "https://example.com/download",
        prescriptionImageUrl: "https://example.com/prescription.png",
        reviewedAt: new Date("2099-07-01T15:00:00.000Z"),
        reviewedByUser: {
          id: "44444444-4444-4444-a444-444444444444",
          name: "staff_clerk_uid",
          email: null,
        },
        reviewNote: "Approved for this week.",
        cancelledAt: null,
        cancelReason: null,
        items: [],
        timelineEntries: [],
        occurrences: [
          {
            id: "99999999-9999-4999-a999-999999999999",
            requestId: "55555555-5555-4555-a555-555555555555",
            medicationItemId: "66666666-6666-4666-a666-666666666666",
            campusId: "11111111-1111-4111-a111-111111111111",
            studentId: "22222222-2222-4222-a222-222222222222",
            dueDate: new Date("2099-07-01T00:00:00.000Z"),
            dueTime: "12:30",
            latestOutcome: MedicationAdministrationOutcome.GIVEN,
            latestLogId: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
            latestRecordedAt: new Date("2099-07-01T05:40:00.000Z"),
            latestRecordedByUserId: "44444444-4444-4444-a444-444444444444",
            latestNote: "Correction note.",
            logs: [
              {
                id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
                occurrenceId: "99999999-9999-4999-a999-999999999999",
                outcome: MedicationAdministrationOutcome.REFUSED,
                recordedByUserId: "44444444-4444-4444-a444-444444444444",
                recordedByUser: {
                  id: "44444444-4444-4444-a444-444444444444",
                  name: "staff_clerk_uid",
                  email: null,
                },
                recordedAt: new Date("2099-07-01T05:35:00.000Z"),
                actualTime: "12:35",
                note: "Student refused.",
                correctionOfLogId: null,
                createdAt: new Date("2099-07-01T05:35:00.000Z"),
                updatedAt: new Date("2099-07-01T05:35:00.000Z"),
                attachmentDownloadUrl: "https://example.com/log-download",
              },
              {
                id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
                occurrenceId: "99999999-9999-4999-a999-999999999999",
                outcome: MedicationAdministrationOutcome.GIVEN,
                recordedByUserId: "44444444-4444-4444-a444-444444444444",
                recordedByUser: null,
                recordedAt: new Date("2099-07-01T05:40:00.000Z"),
                actualTime: "12:40",
                note: "Correction note.",
                correctionOfLogId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
                createdAt: new Date("2099-07-01T05:40:00.000Z"),
                updatedAt: new Date("2099-07-01T05:40:00.000Z"),
                internalOnly: "must not leak",
              },
            ],
            createdAt: new Date("2099-07-01T05:30:00.000Z"),
            updatedAt: new Date("2099-07-01T05:40:00.000Z"),
          },
        ],
        createdAt: new Date("2099-07-01T14:30:00.000Z"),
        updatedAt: new Date("2099-07-01T15:05:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response);

    expect(plain).toMatchObject({
      reviewedByUser: { id: "44444444-4444-4444-a444-444444444444" },
      occurrences: [
        {
          dueDate: "2099-07-01",
          latestOutcome: MedicationAdministrationOutcome.GIVEN,
          logs: [
            { outcome: MedicationAdministrationOutcome.REFUSED },
            {
              outcome: MedicationAdministrationOutcome.GIVEN,
              correctionOfLogId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
            },
          ],
        },
      ],
    });
    expect(plain.occurrences[0].logs[1]).not.toHaveProperty("internalOnly");
    expectNoActiveAttachmentFields(plain);
  });

  it("exposes parent-visible administration occurrences without reviewer detail", () => {
    const response = plainToInstance(
      ParentMedicationRequestDetailResponse,
      {
        id: "55555555-5555-4555-a555-555555555555",
        campusId: "11111111-1111-4111-a111-111111111111",
        studentId: "22222222-2222-4222-a222-222222222222",
        student: null,
        requesterGuardianId: "33333333-3333-4333-a333-333333333333",
        requesterGuardian: null,
        status: MedicationRequestStatus.APPROVED,
        startDate: new Date("2099-07-01T00:00:00.000Z"),
        endDate: new Date("2099-07-05T00:00:00.000Z"),
        reason: null,
        parentNotes: null,
        reviewedAt: new Date("2099-07-01T15:00:00.000Z"),
        reviewedByUser: {
          id: "44444444-4444-4444-a444-444444444444",
          name: "staff_clerk_uid",
          email: null,
        },
        reviewNote: "Approved.",
        cancelledAt: null,
        cancelReason: null,
        items: [],
        timelineEntries: [],
        occurrences: [
          {
            id: "99999999-9999-4999-a999-999999999999",
            requestId: "55555555-5555-4555-a555-555555555555",
            medicationItemId: "66666666-6666-4666-a666-666666666666",
            campusId: "11111111-1111-4111-a111-111111111111",
            studentId: "22222222-2222-4222-a222-222222222222",
            dueDate: new Date("2099-07-01T00:00:00.000Z"),
            dueTime: "12:30",
            latestOutcome: MedicationAdministrationOutcome.GIVEN,
            latestLogId: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
            latestRecordedAt: new Date("2099-07-01T05:40:00.000Z"),
            latestRecordedByUserId: "44444444-4444-4444-a444-444444444444",
            latestNote: "Given after lunch.",
            logs: [
              {
                id: "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
                occurrenceId: "99999999-9999-4999-a999-999999999999",
                outcome: MedicationAdministrationOutcome.GIVEN,
                recordedByUserId: "44444444-4444-4444-a444-444444444444",
                recordedByUser: null,
                recordedAt: new Date("2099-07-01T05:40:00.000Z"),
                actualTime: "12:40",
                note: "Given after lunch.",
                correctionOfLogId: null,
                createdAt: new Date("2099-07-01T05:40:00.000Z"),
                updatedAt: new Date("2099-07-01T05:40:00.000Z"),
              },
            ],
            createdAt: new Date("2099-07-01T05:30:00.000Z"),
            updatedAt: new Date("2099-07-01T05:40:00.000Z"),
          },
        ],
        createdAt: new Date("2099-07-01T14:30:00.000Z"),
        updatedAt: new Date("2099-07-01T15:05:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response);

    expect(plain).toMatchObject({
      occurrences: [
        {
          dueDate: "2099-07-01",
          dueTime: "12:30",
          latestOutcome: MedicationAdministrationOutcome.GIVEN,
          logs: [{ outcome: MedicationAdministrationOutcome.GIVEN }],
        },
      ],
    });
    expect(plain).not.toHaveProperty("reviewedByUser");
  });
});
