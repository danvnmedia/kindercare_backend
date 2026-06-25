import { plainToInstance } from "class-transformer";

import { WeeklyPlanResponse } from "./weekly-plan.response";

describe("WeeklyPlanResponse", () => {
  it("exposes activity title and nullable description without legacy text", () => {
    const response = plainToInstance(
      WeeklyPlanResponse,
      {
        id: "99999999-9999-4999-a999-999999999999",
        campusId: "11111111-1111-4111-a111-111111111111",
        classId: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
        classroom: {
          id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          name: "K1 Room A",
          gradeLevelId: "22222222-2222-4222-a222-222222222222",
          gradeLevelName: "Kindergarten",
          schoolYearId: "33333333-3333-4333-a333-333333333333",
          schoolYearName: "2026-2027",
        },
        weekStartDate: new Date("2026-06-15T00:00:00.000Z"),
        theme: "Community Helpers",
        blocks: [
          {
            dayOfWeek: 1,
            startMinute: 540,
            endMinute: 600,
            activities: [
              {
                order: 0,
                title: "Morning Meeting",
                description: "Greeting and calendar",
                text: "legacy value should not be exposed",
              },
              {
                order: 1,
                title: "Centers",
                description: null,
              },
            ],
          },
        ],
        isArchived: false,
        createdAt: new Date("2026-06-15T12:00:00.000Z"),
        updatedAt: new Date("2026-06-15T12:00:00.000Z"),
      },
      {
        excludeExtraneousValues: true,
        enableImplicitConversion: true,
        exposeUnsetFields: false,
      },
    );

    expect(response.blocks[0].startTime).toBe("09:00");
    expect(response.blocks[0].endTime).toBe("10:00");
    expect(response.blocks[0].activities).toEqual([
      {
        order: 0,
        title: "Morning Meeting",
        description: "Greeting and calendar",
      },
      {
        order: 1,
        title: "Centers",
        description: null,
      },
    ]);
    expect(response.blocks[0].activities[0]).not.toHaveProperty("text");
  });
});
