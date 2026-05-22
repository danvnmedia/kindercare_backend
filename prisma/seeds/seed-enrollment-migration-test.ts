/**
 * Seed script for verifying the add_enrollment_period_columns migration.
 *
 * Spec: @doc/specs/class-enrollment-period-model
 * Task: 3pcj45
 *
 * Pre-production manual verification harness (no e2e infrastructure).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register prisma/seeds/seed-enrollment-migration-test.ts <scenario>
 *
 * Scenarios:
 *   chained     — One student with multiple enrollments in the same class on
 *                 different dates. Validates backfill chains them correctly
 *                 (non-latest rows get end_date = next.start - 1 day).
 *   single-open — One student with a single enrollment. Validates "latest stays open".
 *   conflict    — One student active in two different classes simultaneously.
 *                 Validates the migration aborts with a conflict report.
 *   all         — Run chained + single-open scenarios together (NOT conflict).
 *
 * The script uses raw SQL inserts so it works whether or not the new migration
 * has been applied (i.e. whether end_date / exit_reason columns exist).
 *
 * Verification flow:
 *   1. Move the new migration directory out of prisma/migrations/
 *      (so `migrate reset` applies only prior migrations).
 *   2. `npx prisma migrate reset --skip-seed --force`
 *   3. `npx ts-node -r tsconfig-paths/register prisma/seeds/seed-enrollment-migration-test.ts <scenario>`
 *   4. Restore the migration directory.
 *   5. `npx prisma migrate dev` — backfill / conflict probe runs against seeded data.
 *   6. Verify expected outcome via psql (see task notes for AC-by-AC checks).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIXTURE = {
  campusId: "ee000000-0000-4000-8000-000000000001",
  schoolYearId: "ee000000-0000-4000-8000-000000000002",
  gradeLevelId: "ee000000-0000-4000-8000-000000000003",
  classAId: "ee000000-0000-4000-8000-00000000000a",
  classBId: "ee000000-0000-4000-8000-00000000000b",
  studentChainedId: "ee000000-0000-4000-8000-000000000010",
  studentSingleId: "ee000000-0000-4000-8000-000000000011",
  studentConflictId: "ee000000-0000-4000-8000-000000000012",
};

type Scenario = "chained" | "single-open" | "conflict" | "all";

async function ensureFixtures() {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "campus" (id, name, address, is_archived, created_at, updated_at)
     VALUES ($1::uuid, 'Migration Test Campus', 'Test', false, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    FIXTURE.campusId,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "school_year" (id, name, start_date, end_date, is_archived, campus_id, created_at, updated_at)
     VALUES ($1::uuid, 'Migration Test 2026', '2026-01-01', '2026-12-31', false, $2::uuid, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    FIXTURE.schoolYearId,
    FIXTURE.campusId,
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO "grade_level" (id, name, "order", is_archived, campus_id, created_at, updated_at)
     VALUES ($1::uuid, 'Migration Test Grade', 999, false, $2::uuid, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    FIXTURE.gradeLevelId,
    FIXTURE.campusId,
  );

  for (const [classId, name] of [
    [FIXTURE.classAId, "Migration Test Class A"],
    [FIXTURE.classBId, "Migration Test Class B"],
  ] as const) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "class" (id, name, campus_id, grade_level_id, school_year_id, created_at, updated_at)
       VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5::uuid, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      classId,
      name,
      FIXTURE.campusId,
      FIXTURE.gradeLevelId,
      FIXTURE.schoolYearId,
    );
  }

  for (const [studentId, code, name] of [
    [FIXTURE.studentChainedId, "MIG-CHAINED", "Migration Test — Chained"],
    [FIXTURE.studentSingleId, "MIG-SINGLE", "Migration Test — Single"],
    [FIXTURE.studentConflictId, "MIG-CONFLICT", "Migration Test — Conflict"],
  ] as const) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "student" (id, student_code, full_name, status, is_archived, campus_id, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, 'ACTIVE', false, $4::uuid, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      studentId,
      code,
      name,
      FIXTURE.campusId,
    );
  }
}

async function clearTestEnrollments() {
  await prisma.$executeRawUnsafe(
    `DELETE FROM "enrollment" WHERE student_id IN ($1::uuid, $2::uuid, $3::uuid)`,
    FIXTURE.studentChainedId,
    FIXTURE.studentSingleId,
    FIXTURE.studentConflictId,
  );
}

async function insertEnrollment(
  studentId: string,
  classId: string,
  enrollmentDate: string,
) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "enrollment" (id, class_id, student_id, enrollment_date, created_at, updated_at)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::date, now(), now())`,
    classId,
    studentId,
    enrollmentDate,
  );
}

async function seedChained() {
  // Three enrollments for one student in classA on different dates.
  // After backfill: row1.end_date = '2026-03-31', row2.end_date = '2026-06-30',
  // row3.end_date = NULL (latest). All rows: exit_reason = 'COMPLETED' except row3.
  await insertEnrollment(FIXTURE.studentChainedId, FIXTURE.classAId, "2026-01-15");
  await insertEnrollment(FIXTURE.studentChainedId, FIXTURE.classAId, "2026-04-01");
  await insertEnrollment(FIXTURE.studentChainedId, FIXTURE.classAId, "2026-07-01");
  console.log(
    `[chained] inserted 3 enrollments for student ${FIXTURE.studentChainedId} in class ${FIXTURE.classAId}`,
  );
}

async function seedSingleOpen() {
  // Single enrollment — backfill should leave it with end_date = NULL.
  await insertEnrollment(FIXTURE.studentSingleId, FIXTURE.classAId, "2026-02-01");
  console.log(
    `[single-open] inserted 1 enrollment for student ${FIXTURE.studentSingleId} in class ${FIXTURE.classAId}`,
  );
}

async function seedConflict() {
  // One student active in TWO different classes simultaneously.
  // After migration's conflict probe: must abort with conflict report and roll back.
  await insertEnrollment(FIXTURE.studentConflictId, FIXTURE.classAId, "2026-01-10");
  await insertEnrollment(FIXTURE.studentConflictId, FIXTURE.classBId, "2026-01-15");
  console.log(
    `[conflict] inserted 2 simultaneous enrollments for student ${FIXTURE.studentConflictId} in classes ${FIXTURE.classAId} and ${FIXTURE.classBId}`,
  );
}

async function main() {
  const scenario = (process.argv[2] ?? "all") as Scenario;
  if (!["chained", "single-open", "conflict", "all"].includes(scenario)) {
    console.error(
      `Unknown scenario: ${scenario}. Use one of: chained, single-open, conflict, all`,
    );
    process.exit(1);
  }

  console.log(`Seeding scenario: ${scenario}`);
  await ensureFixtures();
  await clearTestEnrollments();

  if (scenario === "chained" || scenario === "all") await seedChained();
  if (scenario === "single-open" || scenario === "all") await seedSingleOpen();
  if (scenario === "conflict") await seedConflict();

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
