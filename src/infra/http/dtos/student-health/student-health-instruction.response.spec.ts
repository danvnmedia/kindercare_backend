import { instanceToPlain, plainToInstance } from "class-transformer";

import {
  StudentHealthInstructionStatus,
  StudentHealthInstructionType,
} from "@/domain/student-health";

import { StudentHealthInstructionResponse } from "./student-health-instruction.response";

describe("StudentHealthInstructionResponse", () => {
  it("formats date-only fields from ISO strings produced by response serialization", () => {
    const response = plainToInstance(
      StudentHealthInstructionResponse,
      {
        id: "44444444-4444-4444-8444-444444444451",
        studentId: "44444444-4444-4444-8444-444444444445",
        campusId: "11111111-1111-4111-8111-111111111111",
        instructionType: StudentHealthInstructionType.MEDICATION,
        title: "Antibiotic after lunch",
        instruction: "Give with water.",
        dosage: "5 ml",
        startDate: "2026-06-30T00:00:00.000Z",
        endDate: "2026-07-31T00:00:00.000Z",
        timesOfDay: ["12:30"],
        scheduleNotes: null,
        notes: null,
        isActive: true,
        status: StudentHealthInstructionStatus.ACTIVE,
        createdBy: null,
        lastUpdatedBy: null,
        archivedAt: null,
        archivedByUserId: null,
        isArchived: false,
        createdAt: "2026-07-01T08:30:00.000Z",
        updatedAt: "2026-07-01T08:30:00.000Z",
        internalOnly: "must not leak",
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    const plain = instanceToPlain(response);

    expect(plain).toMatchObject({
      startDate: "2026-06-30",
      endDate: "2026-07-31",
      archivedAt: null,
      archivedByUserId: null,
      isArchived: false,
    });
    expect(plain).not.toHaveProperty("internalOnly");
  });
});
