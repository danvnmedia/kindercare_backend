import { instanceToPlain, plainToInstance } from "class-transformer";

import { StudentHealthCheckupType } from "@/domain/student-health";

import { StudentHealthCheckupResponse } from "./student-health-checkup.response";

describe("StudentHealthCheckupResponse", () => {
  it("exposes metric fields without BMI, percentile, or clinical interpretation fields", () => {
    const response = plainToInstance(
      StudentHealthCheckupResponse,
      {
        id: "44444444-4444-4444-a444-444444444444",
        studentId: "33333333-3333-4333-a333-333333333333",
        campusId: "11111111-1111-4111-a111-111111111111",
        checkupType: StudentHealthCheckupType.GROWTH,
        checkedAt: new Date("2020-01-15T09:00:00.000Z"),
        heightCm: 108.5,
        weightKg: 18.6,
        notes: "Routine measurement.",
        recordedBy: {
          id: "55555555-5555-4555-a555-555555555555",
          fullName: "School Nurse",
        },
        lastUpdatedBy: null,
        createdAt: new Date("2020-01-15T09:05:00.000Z"),
        updatedAt: new Date("2020-01-15T09:05:00.000Z"),
        bmi: 15.8,
        bmiPercentile: 60,
        growthPercentile: 75,
        interpretation: "Normal",
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    const plain = instanceToPlain(response);
    expect(plain).toMatchObject({
      heightCm: 108.5,
      weightKg: 18.6,
    });
    expect(plain).not.toHaveProperty("bmi");
    expect(plain).not.toHaveProperty("bmiPercentile");
    expect(plain).not.toHaveProperty("growthPercentile");
    expect(plain).not.toHaveProperty("interpretation");
  });
});
