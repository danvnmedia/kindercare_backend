import { Prisma } from "@prisma/client";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";

interface AdvisoryLockRow {
  lockAcquired: number;
}

/**
 * Serializes school-year registration creation and cancellation for one
 * student/year pair. PostgreSQL returns `void` from pg_advisory_xact_lock, so
 * the query projects a supported integer instead of exposing that value to
 * Prisma's raw-query deserializer.
 */
export async function acquireSchoolYearEnrollmentAdvisoryLock(
  tx: AppTransactionClient,
  studentId: string,
  schoolYearId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<AdvisoryLockRow[]>(Prisma.sql`
    SELECT 1::int AS "lockAcquired"
    FROM pg_advisory_xact_lock(
      hashtextextended(${studentId} || ':' || ${schoolYearId}, 0)
    )
  `);

  if (rows.length !== 1 || rows[0].lockAcquired !== 1) {
    throw new Error("SCHOOL_YEAR_ENROLLMENT_ADVISORY_LOCK_NOT_ACQUIRED");
  }
}
