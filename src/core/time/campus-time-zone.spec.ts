import {
  campusWallTimeToInstant,
  getCampusDateOnly,
  getCampusDateString,
  getCampusStartOfNextDay,
} from "./campus-time-zone";

describe("campus time zone", () => {
  it("derives different local dates for the same instant", () => {
    const instant = new Date("2026-07-14T02:00:00.000Z");

    expect(getCampusDateString(instant, "America/Toronto")).toBe("2026-07-13");
    expect(getCampusDateString(instant, "Asia/Ho_Chi_Minh")).toBe("2026-07-14");
    expect(getCampusDateOnly(instant, "America/Toronto").toISOString()).toBe(
      "2026-07-13T00:00:00.000Z",
    );
  });

  it("shifts a spring-forward gap to the next valid instant", () => {
    expect(
      campusWallTimeToInstant(
        "2026-03-08",
        2 * 60 + 30,
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-03-08T07:00:00.000Z");
  });

  it("uses the earlier instant during a fall-back fold", () => {
    expect(
      campusWallTimeToInstant(
        "2026-11-01",
        1 * 60 + 30,
        "America/Toronto",
      ).toISOString(),
    ).toBe("2026-11-01T05:30:00.000Z");
  });

  it("resolves the next campus day boundary independently of process TZ", () => {
    expect(
      getCampusStartOfNextDay("2026-07-14", "Asia/Ho_Chi_Minh").toISOString(),
    ).toBe("2026-07-14T17:00:00.000Z");
  });
});
