import { instanceToPlain, plainToInstance } from "class-transformer";

import {
  StudentHealthConditionCategory,
  StudentHealthEventStatus,
  StudentHealthEventType,
} from "@/domain/student-health";

import { StudentHealthEventResponse } from "./student-health-event.response";

describe("StudentHealthEventResponse", () => {
  it("exposes clinical status separately from archive metadata", () => {
    const response = plainToInstance(
      StudentHealthEventResponse,
      {
        id: "44444444-4444-4444-a444-444444444444",
        studentId: "33333333-3333-4333-a333-333333333333",
        campusId: "11111111-1111-4111-a111-111111111111",
        eventType: StudentHealthEventType.ILLNESS,
        category: StudentHealthConditionCategory.EYE,
        title: "Eye redness observed",
        description: null,
        occurredAt: new Date("2020-01-15T09:00:00.000Z"),
        status: StudentHealthEventStatus.RESOLVED,
        resolutionNotes: "Guardian confirmed follow-up.",
        recordedBy: null,
        lastUpdatedBy: null,
        archivedAt: new Date("2026-07-02T10:00:00.000Z"),
        archivedByUserId: "55555555-5555-4555-a555-555555555555",
        isArchived: true,
        createdAt: new Date("2020-01-15T09:05:00.000Z"),
        updatedAt: new Date("2026-07-02T10:00:00.000Z"),
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    expect(instanceToPlain(response)).toMatchObject({
      status: StudentHealthEventStatus.RESOLVED,
      archivedAt: new Date("2026-07-02T10:00:00.000Z"),
      archivedByUserId: "55555555-5555-4555-a555-555555555555",
      isArchived: true,
    });
  });
});
