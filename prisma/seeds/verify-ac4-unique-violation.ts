/**
 * AC-4 verification: inserting a second active enrollment for the same student
 * (in any class) must fail with a unique-constraint violation on
 * idx_enrollment_one_active_per_student.
 *
 * Prerequisite: seed-enrollment-migration-test.ts ran with `all` and the
 * migration was applied — so student ...011 already has one active enrollment.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const studentId = "ee000000-0000-4000-8000-000000000011";
  const classBId = "ee000000-0000-4000-8000-00000000000b";

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "enrollment" (id, class_id, student_id, enrollment_date, created_at, updated_at)
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, CURRENT_DATE, now(), now())`,
      classBId,
      studentId,
    );
    console.error("FAIL: insert succeeded but should have raised unique-violation.");
    process.exit(1);
  } catch (err: any) {
    const code = err?.meta?.code ?? err?.code;
    const msg = err?.meta?.message ?? err?.message ?? String(err);
    if (code === "23505" || /idx_enrollment_one_active_per_student/.test(msg)) {
      console.log("PASS: unique-constraint violation as expected.");
      console.log(`  code: ${code}`);
      console.log(`  message: ${msg}`);
    } else {
      console.error("FAIL: insert raised an unexpected error.");
      console.error(err);
      process.exit(1);
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
