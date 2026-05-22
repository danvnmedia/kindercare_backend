import { computeDiff } from "./compute-diff";

describe("computeDiff", () => {
  it("returns empty diffs when no field changed", () => {
    const before = { fullName: "Bob Tran", phoneNumber: "555-1111" };
    const after = { fullName: "Bob Tran", phoneNumber: "555-1111" };

    expect(computeDiff(before, after)).toEqual({ before: {}, after: {} });
  });

  it("includes only the changed field (Scenario 3)", () => {
    const before = { fullName: "Bob Tran", phoneNumber: "555-1111" };
    const after = { phoneNumber: "555-2222" };

    const diff = computeDiff(before, after);

    expect(diff).toEqual({
      before: { phoneNumber: "555-1111" },
      after: { phoneNumber: "555-2222" },
    });
    expect(diff.before).not.toHaveProperty("fullName");
    expect(diff.after).not.toHaveProperty("fullName");
  });

  it("excludes keys not present on `after` even when `before` has them", () => {
    const before = { fullName: "Bob", phoneNumber: "555-1111", email: "a@b.c" };
    const after = { phoneNumber: "555-2222" };

    const diff = computeDiff(before, after);

    expect(Object.keys(diff.after)).toEqual(["phoneNumber"]);
    expect(Object.keys(diff.before)).toEqual(["phoneNumber"]);
  });

  it("records `null` transitions explicitly", () => {
    const before: { address: string | null; phoneNumber: string } = {
      address: "123 Main",
      phoneNumber: "555-1111",
    };
    const after: Partial<typeof before> = { address: null };

    expect(computeDiff(before, after)).toEqual({
      before: { address: "123 Main" },
      after: { address: null },
    });
  });

  it("records value-from-null transitions explicitly", () => {
    const before: { address: string | null } = { address: null };
    const after = { address: "456 Oak" };

    expect(computeDiff(before, after)).toEqual({
      before: { address: null },
      after: { address: "456 Oak" },
    });
  });

  it("treats two Date instances with the same instant as equal", () => {
    const sameInstant = new Date("2026-01-15T00:00:00.000Z");
    const before = { dateOfBirth: sameInstant };
    const after = { dateOfBirth: new Date("2026-01-15T00:00:00.000Z") };

    expect(computeDiff(before, after)).toEqual({ before: {}, after: {} });
  });

  it("detects Date changes by instant", () => {
    const before = { dateOfBirth: new Date("2026-01-15T00:00:00.000Z") };
    const after = { dateOfBirth: new Date("2026-02-20T00:00:00.000Z") };

    const diff = computeDiff(before, after);

    expect(diff.before).toEqual({
      dateOfBirth: new Date("2026-01-15T00:00:00.000Z"),
    });
    expect(diff.after).toEqual({
      dateOfBirth: new Date("2026-02-20T00:00:00.000Z"),
    });
  });

  it("handles multiple changed fields together", () => {
    const before = {
      fullName: "Bob",
      phoneNumber: "555-1111",
      email: "old@x.com",
    };
    const after = { phoneNumber: "555-2222", email: "new@x.com" };

    expect(computeDiff(before, after)).toEqual({
      before: { phoneNumber: "555-1111", email: "old@x.com" },
      after: { phoneNumber: "555-2222", email: "new@x.com" },
    });
  });

  it("falls back to JSON equality for nested object values", () => {
    const before: { meta: { tag: string } } = { meta: { tag: "x" } };
    const after = { meta: { tag: "x" } };

    expect(computeDiff(before, after)).toEqual({ before: {}, after: {} });
  });

  it("detects nested object changes via JSON fallback", () => {
    const before = { meta: { tag: "x" } };
    const after = { meta: { tag: "y" } };

    expect(computeDiff(before, after)).toEqual({
      before: { meta: { tag: "x" } },
      after: { meta: { tag: "y" } },
    });
  });
});
