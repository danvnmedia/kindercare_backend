import { parseDateOnly } from "./date-only";

describe("parseDateOnly", () => {
  it("normalizes yyyy-MM-dd to UTC midnight", () => {
    const parsed = parseDateOnly("2026-07-07");

    expect(parsed.toISOString()).toBe("2026-07-07T00:00:00.000Z");
  });

  it("rejects ISO datetimes", () => {
    expect(() => parseDateOnly("2026-07-07T10:30:00.000Z")).toThrow(
      "Date must be in yyyy-MM-dd format",
    );
  });

  it("rejects invalid calendar dates", () => {
    expect(() => parseDateOnly("2026-02-31")).toThrow(
      "Date must be a valid calendar date",
    );
  });
});
