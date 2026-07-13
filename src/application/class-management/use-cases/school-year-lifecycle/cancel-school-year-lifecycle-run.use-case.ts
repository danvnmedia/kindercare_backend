import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { User } from "@/domain/user-management/user.entity";

import { SchoolYearLifecycleRepository } from "../../ports/school-year-lifecycle.repository";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { SchoolYearLifecycleRunDetail } from "../../school-year-lifecycle";
import { buildSchoolYearLifecycleRunDetail } from "./school-year-lifecycle-run-detail";
import { resolveSchoolYearLifecycleRetention } from "./school-year-lifecycle-retention";

@Injectable()
export class CancelSchoolYearLifecycleRunUseCase {
  constructor(
    @Inject("SCHOOL_YEAR_LIFECYCLE_REPOSITORY")
    private readonly lifecycleRepository: SchoolYearLifecycleRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Optional()
    private readonly historicalRecordRepository?: HistoricalRecordRepository,
  ) {}

  async execute(
    input: {
      lifecycleRunId: string;
      campusId: string;
      expectedVersion: number;
    },
    currentUser: User,
  ): Promise<SchoolYearLifecycleRunDetail> {
    const run = await this.lifecycleRepository.findRunById(
      input.lifecycleRunId,
      input.campusId,
    );
    if (!run) {
      throw new NotFoundException("RUN_NOT_FOUND");
    }
    if (
      run.firstCommittedAt ||
      ["COMPLETED", "CANCELLED", "EXPIRED"].includes(run.status)
    ) {
      throw new ConflictException("RUN_NOT_CANCELLABLE");
    }

    const cancelledAt = new Date();
    const retention = await resolveSchoolYearLifecycleRetention(
      this.historicalRecordRepository,
      input.campusId,
      cancelledAt,
    );
    const updated = await this.lifecycleRepository.updateRunVersioned({
      id: run.id,
      campusId: run.campusId,
      expectedVersion: input.expectedVersion,
      updatedByUserId: currentUser.id,
      status: "CANCELLED",
      cancelledAt,
      lastActivityAt: cancelledAt,
      invalidatePreviews: true,
      retention,
      audit: {
        actorId: currentUser.id,
        action: "CANCEL_SCHOOL_YEAR_LIFECYCLE_RUN",
        targetType: "school_year",
        targetId: run.sourceSchoolYearId,
        campusId: input.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          lifecycleRunId: run.id,
          expectedVersion: input.expectedVersion,
          nextVersion: input.expectedVersion + 1,
          previousStatus: run.status,
          cancelledAt: cancelledAt.toISOString(),
        },
        beforeValue: { status: run.status },
        afterValue: { status: "CANCELLED" },
      },
    });
    if (!updated) {
      const current = await this.lifecycleRepository.findRunById(
        run.id,
        run.campusId,
      );
      throw new ConflictException({
        code: "STALE_RUN_VERSION",
        currentVersion: current?.version ?? run.version,
        lifecycleRunId: run.id,
      });
    }

    return buildSchoolYearLifecycleRunDetail(
      updated,
      this.lifecycleRepository,
      this.schoolYearRepository,
    );
  }
}
