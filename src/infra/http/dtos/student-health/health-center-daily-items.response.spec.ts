import { instanceToPlain, plainToInstance } from "class-transformer";

import { MedicationAdministrationStatus } from "@/domain/medication";
import {
  StudentHealthConditionCategory,
  StudentHealthEventStatus,
  StudentHealthEventType,
  StudentHealthInstructionStatus,
  StudentHealthInstructionType,
} from "@/domain/student-health";

import { HealthCenterDailyItemsResponseDto } from "./health-center-daily-items.response";

describe("HealthCenterDailyItemsResponseDto", () => {
  it("exposes grouped items and formats instruction date-only fields from ISO strings", () => {
    const response = plainToInstance(
      HealthCenterDailyItemsResponseDto,
      {
        campusId: "11111111-1111-4111-a111-111111111111",
        date: "2026-07-01",
        classId: null,
        generatedAt: "2026-07-01T15:30:00.000Z",
        access: {
          healthItems: true,
          medicationAdministrations: true,
          medicationRequests: true,
          canRecordMedication: true,
          canReviewMedicationRequests: true,
        },
        counts: {
          instructions: 1,
          events: 1,
          total: 2,
          medicationAdministrations: 1,
          dueMedicationAdministrations: 1,
          overdueMedicationAdministrations: 0,
          requestsNeedingReview: 2,
          visibleTotal: 3,
          actionRequired: 3,
        },
        pagination: {
          instructions: { offset: 0, limit: 50, total: 1, hasMore: false },
          events: { offset: 0, limit: 50, total: 1, hasMore: false },
          medicationAdministrations: {
            offset: 0,
            limit: 50,
            total: 1,
            hasMore: false,
          },
        },
        instructions: [
          {
            id: "22222222-2222-4222-a222-222222222222",
            studentId: "33333333-3333-4333-a333-333333333333",
            campusId: "11111111-1111-4111-a111-111111111111",
            student: {
              id: "33333333-3333-4333-a333-333333333333",
              fullName: "Alice Student",
              avatarUrl: null,
            },
            class: null,
            instructionType: StudentHealthInstructionType.MEDICATION,
            title: "Antibiotic after lunch",
            instruction: "Give with water.",
            dosage: "5 ml",
            startDate: "2026-07-01T00:00:00.000Z",
            endDate: "2026-07-05T00:00:00.000Z",
            timesOfDay: ["12:30"],
            scheduleNotes: null,
            notes: null,
            isActive: true,
            status: StudentHealthInstructionStatus.ACTIVE,
            createdBy: null,
            lastUpdatedBy: null,
            createdAt: "2026-07-01T08:30:00.000Z",
            updatedAt: "2026-07-01T08:30:00.000Z",
            occurrenceId: "55555555-5555-4555-a555-555555555555",
            medicationItemId: "66666666-6666-4666-a666-666666666666",
            latestOutcome: "GIVEN",
          },
        ],
        events: [
          {
            id: "44444444-4444-4444-a444-444444444444",
            studentId: "33333333-3333-4333-a333-333333333333",
            campusId: "11111111-1111-4111-a111-111111111111",
            student: {
              id: "33333333-3333-4333-a333-333333333333",
              fullName: "Alice Student",
              avatarUrl: null,
            },
            class: null,
            eventType: StudentHealthEventType.ILLNESS,
            category: StudentHealthConditionCategory.EYE,
            title: "Eye redness observed",
            description: null,
            occurredAt: "2026-07-01T14:00:00.000Z",
            status: StudentHealthEventStatus.OPEN,
            resolutionNotes: null,
            recordedBy: null,
            lastUpdatedBy: null,
            createdAt: "2026-07-01T14:10:00.000Z",
            updatedAt: "2026-07-01T14:10:00.000Z",
            occurrenceId: "55555555-5555-4555-a555-555555555555",
            latestOutcome: "GIVEN",
          },
        ],
        medicationAdministrations: [
          {
            occurrenceId: "55555555-5555-4555-a555-555555555555",
            requestId: "66666666-6666-4666-a666-666666666666",
            medicationItemId: "77777777-7777-4777-a777-777777777777",
            student: {
              id: "33333333-3333-4333-a333-333333333333",
              fullName: "Alice Student",
              studentCode: null,
            },
            class: null,
            medicationName: "Antibiotic syrup",
            dosage: null,
            instructions: "Give after lunch with water.",
            dueDate: "2026-07-01T00:00:00.000Z",
            dueTime: "12:30",
            status: MedicationAdministrationStatus.DUE,
            isOverdue: false,
            parentNotes: null,
            latestLog: null,
            latestOutcome: null,
            latestLogId: null,
            latestRecordedAt: null,
            latestRecordedByUserId: null,
            latestNote: null,
            createdAt: "2026-07-01T05:30:00.000Z",
            updatedAt: "2026-07-01T05:30:00.000Z",
            guardian: {
              id: "must-not-leak",
              fullName: "Guardian",
            },
          },
        ],
        hiddenField: "must not leak",
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    const plain = instanceToPlain(response);

    expect(plain).toMatchObject({
      generatedAt: "2026-07-01T15:30:00.000Z",
      access: {
        healthItems: true,
        medicationAdministrations: true,
        medicationRequests: true,
        canRecordMedication: true,
        canReviewMedicationRequests: true,
      },
      counts: {
        instructions: 1,
        events: 1,
        total: 2,
        medicationAdministrations: 1,
        requestsNeedingReview: 2,
        visibleTotal: 3,
        actionRequired: 3,
      },
      instructions: [{ startDate: "2026-07-01", endDate: "2026-07-05" }],
      events: [{ status: StudentHealthEventStatus.OPEN }],
      medicationAdministrations: [
        {
          student: {
            id: "33333333-3333-4333-a333-333333333333",
            fullName: "Alice Student",
            studentCode: null,
          },
          class: null,
          dosage: null,
          dueDate: "2026-07-01",
          latestLog: null,
          latestOutcome: null,
        },
      ],
    });
    expect(plain.instructions[0]).not.toHaveProperty("occurrenceId");
    expect(plain.instructions[0]).not.toHaveProperty("medicationItemId");
    expect(plain.instructions[0]).not.toHaveProperty("latestOutcome");
    expect(plain.events[0]).not.toHaveProperty("occurrenceId");
    expect(plain.events[0]).not.toHaveProperty("latestOutcome");
    expect(plain.medicationAdministrations[0]).not.toHaveProperty("guardian");
    expect(plain).not.toHaveProperty("hiddenField");
  });
});
