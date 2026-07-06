import { instanceToPlain, plainToInstance } from "class-transformer";

import {
  MedicationAdministrationOutcome,
  MedicationAdministrationStatus,
} from "@/domain/medication";

import {
  MedicationAdministrationQueueItemResponse,
  MedicationAdministrationRecordResponse,
} from "./medication-administration.response";

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

describe("MedicationAdministrationResponse", () => {
  it("daily queue response does not expose active attachment upload or download fields", () => {
    const response = plainToInstance(
      MedicationAdministrationQueueItemResponse,
      {
        occurrenceId: "123e4567-e89b-12d3-a456-426614174010",
        requestId: "123e4567-e89b-12d3-a456-426614174011",
        medicationItemId: "123e4567-e89b-12d3-a456-426614174012",
        student: {
          id: "22222222-2222-4222-a222-222222222222",
          fullName: "Ava Nguyen",
          studentCode: "S-0001",
          attachmentId: "must-not-leak",
        },
        class: {
          id: "99999999-9999-4999-a999-999999999999",
          name: "Sunflower",
          downloadUrl: "https://example.com/class-download",
        },
        medicationName: "Antibiotic syrup",
        dosage: "5 ml",
        instructions: "Give after lunch with water.",
        attachments: [{ id: "must-not-leak" }],
        attachmentUploadUrl: "https://example.com/upload",
        attachmentDownloadUrl: "https://example.com/download",
        prescriptionImageUrl: "https://example.com/prescription.png",
        dueDate: new Date("2099-07-01T00:00:00.000Z"),
        dueTime: "12:30",
        status: MedicationAdministrationStatus.DUE,
        isOverdue: false,
        parentNotes: "Call me if vomiting occurs.",
        latestLog: {
          id: "123e4567-e89b-12d3-a456-426614174005",
          outcome: MedicationAdministrationOutcome.GIVEN,
          recordedByUserId: "44444444-4444-4444-a444-444444444444",
          recordedAt: new Date("2099-07-01T05:35:00.000Z"),
          actualTime: "12:35",
          note: "Given with lunch.",
          correctionOfLogId: null,
          createdAt: new Date("2099-07-01T05:35:00.000Z"),
          updatedAt: new Date("2099-07-01T05:35:00.000Z"),
          downloadUrl: "https://example.com/log-download",
        },
        latestOutcome: MedicationAdministrationOutcome.GIVEN,
        latestLogId: "123e4567-e89b-12d3-a456-426614174005",
        latestRecordedAt: new Date("2099-07-01T05:35:00.000Z"),
        latestRecordedByUserId: "44444444-4444-4444-a444-444444444444",
        latestNote: "Given with lunch.",
        createdAt: new Date("2099-07-01T05:30:00.000Z"),
        updatedAt: new Date("2099-07-01T05:35:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response);

    expect(plain).toMatchObject({
      occurrenceId: "123e4567-e89b-12d3-a456-426614174010",
      medicationName: "Antibiotic syrup",
      dueDate: "2099-07-01",
      latestLog: {
        outcome: MedicationAdministrationOutcome.GIVEN,
      },
    });
    expectNoActiveAttachmentFields(plain);
  });

  it("record response does not expose active attachment upload or download fields", () => {
    const response = plainToInstance(
      MedicationAdministrationRecordResponse,
      {
        occurrenceId: "123e4567-e89b-12d3-a456-426614174010",
        status: MedicationAdministrationOutcome.GIVEN,
        isOverdue: false,
        attachments: [{ id: "must-not-leak" }],
        uploadUrl: "https://example.com/upload",
        downloadUrl: "https://example.com/download",
        latestLog: {
          id: "123e4567-e89b-12d3-a456-426614174005",
          outcome: MedicationAdministrationOutcome.GIVEN,
          recordedByUserId: "44444444-4444-4444-a444-444444444444",
          recordedAt: new Date("2099-07-01T05:35:00.000Z"),
          actualTime: "12:35",
          note: "Given with lunch.",
          correctionOfLogId: null,
          createdAt: new Date("2099-07-01T05:35:00.000Z"),
          updatedAt: new Date("2099-07-01T05:35:00.000Z"),
          attachmentDownloadUrl: "https://example.com/log-download",
        },
        latestOutcome: MedicationAdministrationOutcome.GIVEN,
        latestLogId: "123e4567-e89b-12d3-a456-426614174005",
        latestRecordedAt: new Date("2099-07-01T05:35:00.000Z"),
        latestRecordedByUserId: "44444444-4444-4444-a444-444444444444",
        latestNote: "Given with lunch.",
        updatedAt: new Date("2099-07-01T05:35:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    const plain = instanceToPlain(response);

    expect(plain).toMatchObject({
      occurrenceId: "123e4567-e89b-12d3-a456-426614174010",
      latestLog: {
        outcome: MedicationAdministrationOutcome.GIVEN,
      },
    });
    expectNoActiveAttachmentFields(plain);
  });
});
