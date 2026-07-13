import "reflect-metadata";

import { instanceToPlain, plainToInstance } from "class-transformer";
import { DECORATORS } from "@nestjs/swagger";

import { EnrollmentEffectiveStatusFilter } from "@/application/class-management/enrollment-effective-status-filter";
import { ClassController } from "../../controllers/class-management/class.controller";
import { ClassListItemResponse } from "./class.response";

describe("class roster/count HTTP contract", () => {
  it("documents effectiveStatus and removes includeHistorical", () => {
    const handler = ClassController.prototype.getEnrollments;
    const parameters = Reflect.getMetadata(
      DECORATORS.API_PARAMETERS,
      handler,
    ) as Array<{
      name?: string;
      schema?: { enum?: string[] };
      required?: boolean;
    }>;

    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "effectiveStatus",
          required: false,
          schema: expect.objectContaining({
            enum: Object.values(EnrollmentEffectiveStatusFilter),
          }),
        }),
      ]),
    );
    expect(
      parameters.some((parameter) => parameter.name === "includeHistorical"),
    ).toBe(false);
  });

  it("serializes exactly the three status counts without studentCount", () => {
    const response = plainToInstance(
      ClassListItemResponse,
      {
        id: "class-1",
        name: "Class A",
        description: null,
        campusId: "campus-1",
        gradeLevelId: "grade-1",
        schoolYearId: "year-1",
        activeStudentCount: 2,
        upcomingStudentCount: 3,
        historicalStudentCount: 4,
        studentCount: 99,
        staff: [],
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      { excludeExtraneousValues: true },
    );

    expect(instanceToPlain(response)).toMatchObject({
      activeStudentCount: 2,
      upcomingStudentCount: 3,
      historicalStudentCount: 4,
    });
    expect(instanceToPlain(response)).not.toHaveProperty("studentCount");
  });
});
