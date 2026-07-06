import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateMedicationRequestRequest } from "./create-medication-request.request";

const validPayload = {
  studentId: "22222222-2222-4222-a222-222222222222",
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

describe("CreateMedicationRequestRequest", () => {
  it("accepts a valid parent medication request payload", async () => {
    const dto = plainToInstance(CreateMedicationRequestRequest, validPayload);

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it("rejects invalid date-only and nested schedule payloads", async () => {
    const dto = plainToInstance(CreateMedicationRequestRequest, {
      ...validPayload,
      startDate: "2026-07-01T10:00:00.000Z",
      items: [
        {
          ...validPayload.items[0],
          timesOfDay: [],
        },
        {
          ...validPayload.items[0],
          medicationName: "",
          timesOfDay: ["25:00"],
        },
      ],
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(["startDate", "items"]),
    );
    expect(JSON.stringify(errors)).toContain("timesOfDay");
    expect(JSON.stringify(errors)).toContain("medicationName");
  });
});
