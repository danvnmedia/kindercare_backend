import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { HealthCenterDailyItemsQuery } from "./health-center-daily-items.query";

describe("HealthCenterDailyItemsQuery", () => {
  const transform = (input: Record<string, unknown>) =>
    plainToInstance(HealthCenterDailyItemsQuery, input);

  it.each([
    ["true", true],
    ["false", false],
    [true, true],
    [false, false],
  ])("strictly transforms summaryOnly=%p", async (value, expected) => {
    const query = transform({ summaryOnly: value });

    await expect(validate(query)).resolves.toEqual([]);
    expect(query.summaryOnly).toBe(expected);
  });

  it.each(["1", "yes", ""])(
    "rejects non-literal summaryOnly=%p",
    async (value) => {
      const errors = await validate(transform({ summaryOnly: value }));

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: "summaryOnly" }),
        ]),
      );
    },
  );

  it("defaults all independent pagination groups and summaryOnly", async () => {
    const query = transform({});

    await expect(validate(query)).resolves.toEqual([]);
    expect(query).toMatchObject({
      instructionsOffset: 0,
      instructionsLimit: 50,
      eventsOffset: 0,
      eventsLimit: 50,
      medicationsOffset: 0,
      medicationsLimit: 50,
      summaryOnly: false,
    });
  });

  it("validates medication pagination bounds independently", async () => {
    const errors = await validate(
      transform({
        instructionsOffset: "10",
        instructionsLimit: "25",
        medicationsOffset: "-1",
        medicationsLimit: "101",
      }),
    );

    expect(errors.map((error) => error.property).sort()).toEqual([
      "medicationsLimit",
      "medicationsOffset",
    ]);
  });
});
