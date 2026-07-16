import { readFileSync } from "fs";
import { resolve } from "path";

describe("student health archive migration", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260714171000_add_student_health_archive_metadata/migration.sql",
    ),
    "utf8",
  );

  it.each([
    "student_health_checkup",
    "student_health_instruction",
    "student_health_event",
  ])("adds archive metadata and a SetNull actor relation to %s", (table) => {
    expect(sql).toContain(`ALTER TABLE "${table}"`);
    expect(sql).toContain('ADD COLUMN "archived_at" TIMESTAMPTZ(6)');
    expect(sql).toContain('ADD COLUMN "archived_by_user_id" UUID');
    expect(sql).toContain(`CONSTRAINT "${table}_archived_by_user_id_fkey"`);
    const constraintStart = sql.indexOf(
      `CONSTRAINT "${table}_archived_by_user_id_fkey"`,
    );
    expect(sql.slice(constraintStart, constraintStart + 250)).toContain(
      "ON DELETE SET NULL",
    );
  });

  it("preserves legacy ARCHIVED event context before replacing the enum", () => {
    const backfillPosition = sql.indexOf("WHERE \"status\" = 'ARCHIVED'");
    const enumReplacementPosition = sql.indexOf(
      'ALTER TYPE "StudentHealthEventStatus" RENAME',
    );

    expect(sql).toContain('"archived_at" = "updated_at"');
    expect(sql).toContain('"archived_by_user_id" = "last_updated_by_user_id"');
    expect(sql).toContain("\"status\" = 'RESOLVED'");
    expect(backfillPosition).toBeGreaterThan(-1);
    expect(backfillPosition).toBeLessThan(enumReplacementPosition);
    expect(sql).toContain(
      "CREATE TYPE \"StudentHealthEventStatus\" AS ENUM ('OPEN', 'RESOLVED')",
    );
  });

  it("adds active-only lookup indexes without removing history indexes", () => {
    expect(sql).toContain("student_health_checkup_archive_lookup_idx");
    expect(sql).toContain("student_health_instruction_archive_lookup_idx");
    expect(sql).toContain("student_health_instruction_health_center_idx");
    expect(sql).toContain("student_health_event_archive_timeline_idx");
    expect(sql).toContain("student_health_event_health_center_idx");
    expect(sql).not.toContain("DROP INDEX");
  });
});
