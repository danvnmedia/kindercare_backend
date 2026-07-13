import { Inject, Injectable } from "@nestjs/common";

import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { resolveSchoolYearLifecycleRetention } from "./school-year-lifecycle-retention";

export const SCHOOL_YEAR_LIFECYCLE_RUN_INACTIVITY_DAYS = 90;

export interface ExpireInactiveSchoolYearLifecycleRunsResult {
  scannedCount: number;
  expiredCount: number;
  skippedCount: number;
  expiredRunIds: string[];
}

@Injectable()
export class ExpireInactiveSchoolYearLifecycleRunsUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    private readonly historicalRecordRepository: HistoricalRecordRepository,
  ) {}

  async execute(
    now = new Date(),
    limit = 200,
  ): Promise<ExpireInactiveSchoolYearLifecycleRunsResult> {
    const inactiveBefore = new Date(now);
    inactiveBefore.setUTCDate(
      inactiveBefore.getUTCDate() - SCHOOL_YEAR_LIFECYCLE_RUN_INACTIVITY_DAYS,
    );
    const candidates =
      await this.lifecycleRepository.findInactiveUncommittedRuns(
        inactiveBefore,
        limit,
      );
    const expiredRunIds: string[] = [];

    for (const run of candidates) {
      const retention = await resolveSchoolYearLifecycleRetention(
        this.historicalRecordRepository,
        run.campusId,
        now,
      );
      const expired = await this.lifecycleRepository.expireInactiveRun({
        lifecycleRunId: run.id,
        campusId: run.campusId,
        expectedVersion: run.version,
        inactiveBefore,
        expiredAt: now,
        retention,
        audit: {
          // AuditEvent currently requires a user FK. The run owner is retained
          // as the accountable actor while context identifies the system job.
          actorId: run.updatedByUserId ?? run.createdByUserId,
          action: "EXPIRE_SCHOOL_YEAR_LIFECYCLE_RUN",
          targetType: "school_year",
          targetId: run.sourceSchoolYearId,
          campusId: run.campusId,
          context: {
            initiatedBy: "SYSTEM_INACTIVITY_JOB",
            lifecycleRunId: run.id,
            expectedVersion: run.version,
            nextVersion: run.version + 1,
            previousStatus: run.status,
            expiredAt: now.toISOString(),
            inactiveBefore: inactiveBefore.toISOString(),
            inactivityDays: SCHOOL_YEAR_LIFECYCLE_RUN_INACTIVITY_DAYS,
          },
          beforeValue: { status: run.status },
          afterValue: { status: "EXPIRED" },
        },
      });
      if (expired) {
        expiredRunIds.push(expired.id);
      }
    }

    return {
      scannedCount: candidates.length,
      expiredCount: expiredRunIds.length,
      skippedCount: candidates.length - expiredRunIds.length,
      expiredRunIds,
    };
  }
}
