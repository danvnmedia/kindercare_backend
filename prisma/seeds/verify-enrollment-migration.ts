/**
 * Verification harness for migration 20260505160000_add_enrollment_period_columns.
 * Used in lieu of psql since psql is not on the dev host PATH.
 *
 * Usage: npx ts-node -r tsconfig-paths/register prisma/seeds/verify-enrollment-migration.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Schema check (AC-1) ===");
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string; data_type: string; is_nullable: string }>>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_name = 'enrollment'
       AND column_name IN ('end_date', 'exit_reason')
     ORDER BY column_name`,
  );
  console.table(cols);

  const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string; indexdef: string }>>(
    `SELECT indexname, indexdef
     FROM pg_indexes
     WHERE tablename = 'enrollment'
       AND indexname = 'idx_enrollment_one_active_per_student'`,
  );
  console.table(indexes);

  console.log("\n=== Backfill check (AC-2) ===");
  const rows = await prisma.$queryRawUnsafe<Array<unknown>>(
    `SELECT student_id, class_id, enrollment_date, end_date, exit_reason
     FROM enrollment
     WHERE student_id IN ('ee000000-0000-4000-8000-000000000010', 'ee000000-0000-4000-8000-000000000011')
     ORDER BY student_id, enrollment_date`,
  );
  console.table(rows);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
