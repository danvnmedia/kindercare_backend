import { readFileSync } from "fs";
import { join } from "path";

describe("medication terminal timestamps migration", () => {
  const migration = readFileSync(
    join(
      process.cwd(),
      "prisma/migrations/20260714172000_add_medication_terminal_timestamps/migration.sql",
    ),
    "utf8",
  );

  it("adds nullable terminal timestamp columns", () => {
    expect(migration).toContain('ADD COLUMN "completed_at" TIMESTAMPTZ(6)');
    expect(migration).toContain('ADD COLUMN "expired_at" TIMESTAMPTZ(6)');
    expect(migration).not.toMatch(
      /ADD COLUMN "(?:completed_at|expired_at)"[^;]*NOT NULL/,
    );
  });

  it.each([
    ["COMPLETED", "completed_at"],
    ["EXPIRED", "expired_at"],
  ])("backfills %s rows from updated_at", (status, column) => {
    expect(migration).toContain(`SET "${column}" = "updated_at"`);
    expect(migration).toContain(`WHERE "status" = '${status}'`);
    expect(migration).toContain(`AND "${column}" IS NULL`);
  });
});
