import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AttendanceClassOptionsQuery } from "./attendance-class-options.query";

describe("AttendanceClassOptionsQuery", () => {
  it("coerces valid pagination and trims search", async () => {
    const query = plainToInstance(AttendanceClassOptionsQuery, {
      search: "  Sun  ",
      limit: "100",
      offset: "25",
      sort: "name",
    });

    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      search: "Sun",
      limit: 100,
      offset: 25,
      sort: "name",
    });
  });

  it.each([
    { limit: "0" },
    { limit: "101" },
    { limit: "1.5" },
    { offset: "-1" },
    { sort: "createdAt" },
  ])("rejects invalid query input %#", async (value) => {
    const query = plainToInstance(AttendanceClassOptionsQuery, value);
    expect(await validate(query)).not.toHaveLength(0);
  });
});
