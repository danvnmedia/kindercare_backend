import { readFileSync } from "fs";
import { resolve } from "path";

describe("upcoming cancellation commit guard migration", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260711173000_enforce_upcoming_cancellation_at_commit/migration.sql",
    ),
    "utf8",
  );

  it("uses deferred constraint triggers and the live UTC database clock", () => {
    expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
    expect(sql.match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(2);
    expect(sql).toContain("clock_timestamp() AT TIME ZONE 'UTC'");
    expect(sql).not.toContain("CURRENT_DATE");
  });

  it("guards both parent and child cancellation with stable constraint names", () => {
    expect(sql).toContain("sye_cancel_requires_upcoming_at_commit");
    expect(sql).toContain("ENROLLMENT_ALREADY_EFFECTIVE");
    expect(sql).toContain("enrollment_cancel_requires_upcoming_at_commit");
    expect(sql).toContain("CANCELLATION_CHILD_STATE_CONFLICT");
  });
});
