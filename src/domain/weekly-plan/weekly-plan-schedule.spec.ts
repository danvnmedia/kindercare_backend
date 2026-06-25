import {
  blockEndTime,
  blockStartTime,
  normalizeOptionalTheme,
  normalizeWeekStartDate,
  normalizeWeeklyPlanBlocks,
} from "./weekly-plan-schedule";

describe("weekly-plan schedule helpers", () => {
  it("normalizes weekStartDate to a UTC Monday date-only value", () => {
    const normalized = normalizeWeekStartDate(
      new Date("2026-06-15T18:30:00.000Z"),
    );

    expect(normalized.toISOString()).toBe("2026-06-15T00:00:00.000Z");
  });

  it("rejects non-Monday weekStartDate values", () => {
    expect(() =>
      normalizeWeekStartDate(new Date("2026-06-16T00:00:00.000Z")),
    ).toThrow("weekStartDate must be a Monday");
  });

  it("trims theme and clears blank values", () => {
    expect(normalizeOptionalTheme("  Community Helpers  ")).toBe(
      "Community Helpers",
    );
    expect(normalizeOptionalTheme("   ")).toBeNull();
    expect(normalizeOptionalTheme(null)).toBeNull();
  });

  it("sorts blocks and preserves activity order", () => {
    const blocks = normalizeWeeklyPlanBlocks([
      {
        dayOfWeek: 3,
        startTime: "10:00",
        endTime: "10:30",
        activities: [{ title: "Story" }, { title: "Centers" }],
      },
      {
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        activities: [{ title: "Morning Meeting" }],
      },
    ]);

    expect(blocks.map((block) => block.dayOfWeek)).toEqual([1, 3]);
    expect(blockStartTime(blocks[0])).toBe("09:00");
    expect(blockEndTime(blocks[0])).toBe("10:00");
    expect(blocks[1].activities.map((activity) => activity.title)).toEqual([
      "Story",
      "Centers",
    ]);
  });

  it("normalizes activity title and description values", () => {
    const blocks = normalizeWeeklyPlanBlocks([
      {
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
        activities: [
          {
            title: "  Morning Meeting  ",
            description: "  Greeting and calendar  ",
          },
          {
            title: "Centers",
            description: "   ",
          },
          {
            title: "Cleanup",
            description: null,
            order: 5,
          },
        ],
      },
    ]);

    expect(blocks[0].activities).toEqual([
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
      {
        order: 5,
        title: "Cleanup",
        description: null,
      },
    ]);
  });

  it("rejects missing, blank, and overlength activity titles", () => {
    const baseBlock = {
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
    };

    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          ...baseBlock,
          activities: [{ title: "   " }],
        },
      ]),
    ).toThrow("Activity title is required");

    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          ...baseBlock,
          activities: [{ text: "Legacy text" } as never],
        },
      ]),
    ).toThrow("Activity title is required");

    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          ...baseBlock,
          activities: [{ title: "A".repeat(501) }],
        },
      ]),
    ).toThrow("Activity title must not exceed 500 characters");
  });

  it("rejects non-string activity title and description values", () => {
    const baseBlock = {
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:00",
    };

    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          ...baseBlock,
          activities: [{ title: 123 } as never],
        },
      ]),
    ).toThrow("Activity title is required");

    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          ...baseBlock,
          activities: [
            {
              title: "Morning Meeting",
              description: 123,
            } as never,
          ],
        },
      ]),
    ).toThrow("Activity description must be a string when provided");
  });

  it("rejects overlength activity descriptions", () => {
    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          activities: [
            {
              title: "Morning Meeting",
              description: "A".repeat(2001),
            },
          ],
        },
      ]),
    ).toThrow("Activity description must not exceed 2000 characters");
  });

  it("allows adjacent blocks and rejects overlaps on the same day", () => {
    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          activities: [{ title: "A" }],
        },
        {
          dayOfWeek: 1,
          startTime: "10:00",
          endTime: "10:30",
          activities: [{ title: "B" }],
        },
      ]),
    ).not.toThrow();

    expect(() =>
      normalizeWeeklyPlanBlocks([
        {
          dayOfWeek: 1,
          startTime: "09:00",
          endTime: "10:00",
          activities: [{ title: "A" }],
        },
        {
          dayOfWeek: 1,
          startTime: "09:30",
          endTime: "10:30",
          activities: [{ title: "B" }],
        },
      ]),
    ).toThrow("Blocks must not overlap within the same day");
  });
});
