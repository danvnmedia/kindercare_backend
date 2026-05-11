/**
 * NFR-1 verification: applying the documented down-migration SQL drops the
 * partial index and both columns cleanly, leaving the table at its prior shape.
 *
 * After running, the script re-applies the forward SQL so the DB is left in
 * the migrated state (matching `_prisma_migrations` tracking).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkColumns(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'enrollment' AND column_name IN ('end_date', 'exit_reason')`,
  );
  return rows.map((r) => r.column_name).sort();
}

async function checkIndex(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ indexname: string }>>(
    `SELECT indexname FROM pg_indexes
     WHERE tablename = 'enrollment' AND indexname = 'idx_enrollment_one_active_per_student'`,
  );
  return rows.length === 1;
}

async function main() {
  console.log("Pre-down state:");
  console.log("  columns:", await checkColumns());
  console.log("  partial index exists:", await checkIndex());

  console.log("\nApplying down SQL...");
  await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "idx_enrollment_one_active_per_student"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "enrollment" DROP COLUMN IF EXISTS "exit_reason"`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "enrollment" DROP COLUMN IF EXISTS "end_date"`);

  console.log("\nPost-down state (NFR-1 expectation):");
  const colsAfter = await checkColumns();
  const idxAfter = await checkIndex();
  console.log("  columns:", colsAfter);
  console.log("  partial index exists:", idxAfter);

  if (colsAfter.length === 0 && !idxAfter) {
    console.log("\nPASS: down migration drops both columns and the partial index cleanly.");
  } else {
    console.error("\nFAIL: down migration left residue.");
    process.exit(1);
  }

  console.log("\nRe-applying forward SQL so DB matches Prisma migration tracking...");
  await prisma.$executeRawUnsafe(`ALTER TABLE "enrollment" ADD COLUMN "end_date" DATE`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "enrollment" ADD COLUMN "exit_reason" TEXT`);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX "idx_enrollment_one_active_per_student"
       ON "enrollment" (student_id) WHERE end_date IS NULL`,
  );
  console.log("Done. DB is in migrated state, table is empty.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
