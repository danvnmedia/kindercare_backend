import { AppTransactionClient } from "@/application/ports/transaction-runner.port";

import { acquireSchoolYearEnrollmentAdvisoryLock } from "./advisory-lock";

describe("acquireSchoolYearEnrollmentAdvisoryLock", () => {
  it("projects a Prisma-supported result while acquiring the transaction lock", async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ lockAcquired: 1 }]);
    const tx = { $queryRaw: queryRaw } as unknown as AppTransactionClient;

    await acquireSchoolYearEnrollmentAdvisoryLock(
      tx,
      "student-1",
      "school-year-1",
    );

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0];
    const statement = sql.strings.join(" ");
    expect(statement).toContain('SELECT 1::int AS "lockAcquired"');
    expect(statement).toContain("FROM pg_advisory_xact_lock");
    expect(statement).not.toContain("SELECT pg_advisory_xact_lock");
    expect(sql.values).toEqual(["student-1", "school-year-1"]);
  });

  it("fails closed when PostgreSQL does not return the lock sentinel", async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
    } as unknown as AppTransactionClient;

    await expect(
      acquireSchoolYearEnrollmentAdvisoryLock(tx, "student-1", "school-year-1"),
    ).rejects.toThrow("SCHOOL_YEAR_ENROLLMENT_ADVISORY_LOCK_NOT_ACQUIRED");
  });
});
