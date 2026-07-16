import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { ListStudentHealthCheckupsQuery } from "./list-student-health-checkups.query";
import { ListStudentHealthEventsQuery } from "./list-student-health-events.query";
import { ListStudentHealthInstructionsQuery } from "./list-student-health-instructions.query";

const QUERY_TYPES = [
  ListStudentHealthCheckupsQuery,
  ListStudentHealthEventsQuery,
  ListStudentHealthInstructionsQuery,
];

describe.each(QUERY_TYPES)("%p includeArchived", (QueryType) => {
  const transform = (includeArchived?: unknown) =>
    plainToInstance(
      QueryType,
      includeArchived === undefined ? {} : { includeArchived },
      { enableImplicitConversion: true },
    );

  it.each([
    ["true", true],
    ["false", false],
    [true, true],
    [false, false],
  ])("parses %p strictly", async (raw, expected) => {
    const query = transform(raw);

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.includeArchived).toBe(expected);
  });

  it.each(["yes", "1", "0", "", 1, 0])("rejects %p", async (raw) => {
    const errors = await validate(transform(raw));

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "includeArchived" }),
      ]),
    );
  });

  it("accepts omission without applying an override", async () => {
    const query = transform();

    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.includeArchived).toBeUndefined();
  });
});
