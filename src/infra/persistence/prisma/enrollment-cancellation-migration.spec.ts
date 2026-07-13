import { readFileSync } from "fs";
import { join } from "path";

describe("enrollment cancellation migration", () => {
  const migrationPath = join(
    process.cwd(),
    "prisma/migrations/20260711153000_add_enrollment_cancellation_status/migration.sql",
  );
  const migration = readFileSync(migrationPath, "utf8");

  it("adds nullable cancellation facts without a cancellation backfill", () => {
    expect(migration).toContain('ADD COLUMN "cancelled_at" TIMESTAMPTZ(6)');
    expect(migration).toContain('ADD COLUMN "cancellation_reason" TEXT');
    expect(migration).toContain('ADD COLUMN "cancelled_by_user_id" UUID');
    expect(migration).toContain(
      "Existing rows remain uncancelled because every new column is nullable",
    );
    expect(migration).not.toMatch(
      /UPDATE\s+"(?:enrollment|school_year_enrollment)"\s+SET\s+"?cancelled_at"?/i,
    );
  });

  it("preflights invalid and overlapping inclusive intervals with diagnostics", () => {
    expect(migration).toContain("ENROLLMENT_INTERVAL_INVALID");
    expect(migration).toContain("ENROLLMENT_PERIOD_OVERLAP");
    expect(migration).toContain(
      "student=%s left=%s class=%s [%s,%s] right=%s class=%s [%s,%s]",
    );
    expect(migration).toContain(
      "daterange(\n       left_row.enrollment_date,\n       left_row.end_date,\n       '[]'",
    );
    expect(migration.indexOf("ENROLLMENT_PERIOD_OVERLAP")).toBeLessThan(
      migration.indexOf("BEGIN;"),
    );
  });

  it("enforces cancellation-aware uniqueness and non-overlap", () => {
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS btree_gist");
    expect(migration).toContain(
      'CONSTRAINT "enrollment_no_uncancelled_period_overlap"',
    );
    expect(migration).toContain("WHERE (cancelled_at IS NULL)");
    expect(migration).toContain(
      "WHERE exit_date IS NULL AND cancelled_at IS NULL",
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "idx_enrollment_unique_uncancelled_start"',
    );
    expect(
      migration.match(/AND cancellation_reason IS NOT NULL/g),
    ).toHaveLength(2);
  });

  it("documents restoration of the replaced legacy uniqueness constraints", () => {
    expect(migration).toContain(
      'ADD CONSTRAINT "enrollment_student_id_class_id_enrollment_date_key"',
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "idx_enrollment_one_active_per_student"',
    );
  });

  it("rebuilds student_with_phase with UTC inclusive effective predicates", () => {
    expect(migration).toContain(
      "(CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date AS today",
    );
    expect(migration).toContain("enrollment.cancelled_at IS NULL");
    expect(migration).toContain(
      "enrollment.enrollment_date <= utc_clock.today",
    );
    expect(migration).toContain("enrollment.end_date >= utc_clock.today");
    expect(migration).toContain("parent.cancelled_at IS NULL");
    expect(migration).toContain("parent.enrollment_date > utc_clock.today");
    expect(migration).toContain("parent.exit_date < utc_clock.today");
    expect(migration).toContain(
      "current_enrollment.class_id AS current_class_id",
    );
  });

  it("does not reference attendance storage", () => {
    expect(migration.toLowerCase()).not.toContain('"attendance"');
    expect(migration.toLowerCase()).not.toContain('"attendance_record"');
  });
});
