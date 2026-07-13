import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  EnrollmentCancellationLifecycleResult,
  EnrollmentCancellationRepository,
} from "@/application/class-management/ports/enrollment-cancellation.repository";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";

import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { PrismaSchoolYearEnrollmentMapper } from "../mapper/prisma-school-year-enrollment.mapper";
import { acquireSchoolYearEnrollmentAdvisoryLock } from "../advisory-lock";
import { PrismaService } from "../prisma.service";

const parentInclude = {
  student: true,
  schoolYear: true,
  gradeLevel: true,
} as const;

const childInclude = {
  class: { include: { schoolYear: true, gradeLevel: true } },
  student: true,
} as const;

@Injectable()
export class PrismaEnrollmentCancellationRepository
  implements EnrollmentCancellationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findParentById(
    id: string,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearEnrollment | null> {
    const client = tx ?? this.prisma;
    const row = await client.schoolYearEnrollment.findUnique({
      where: { id },
      include: parentInclude,
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findChildrenByParentId(
    schoolYearEnrollmentId: string,
    tx?: AppTransactionClient,
  ): Promise<Enrollment[]> {
    const client = tx ?? this.prisma;
    const rows = await client.enrollment.findMany({
      where: { schoolYearEnrollmentId },
      include: childInclude,
      orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
    });
    return PrismaEnrollmentMapper.toDomainArray(rows);
  }

  async cancelParentIfUpcoming(
    parent: SchoolYearEnrollment,
    referenceDate: Date,
    tx: AppTransactionClient,
  ): Promise<SchoolYearEnrollment | null> {
    void referenceDate;
    await acquireSchoolYearEnrollmentAdvisoryLock(
      tx,
      parent.studentId,
      parent.schoolYearId,
    );
    const updatedCount = await tx.$executeRaw(Prisma.sql`
      UPDATE school_year_enrollment
      SET cancelled_at = ${parent.cancelledAt},
          cancellation_reason = ${parent.cancellationReason},
          cancellation_note = ${parent.cancellationNote},
          cancelled_by_user_id = ${parent.cancelledByUserId}::uuid,
          cancelled_by_full_name = ${parent.cancelledByFullName},
          historical_finalized_at = ${parent.historicalFinalizedAt},
          updated_at = ${parent.updatedAt}
      WHERE id = ${parent.id}::uuid
        AND campus_id = ${parent.campusId}::uuid
        AND cancelled_at IS NULL
        AND exit_date IS NULL
        AND enrollment_date > (clock_timestamp() AT TIME ZONE 'UTC')::date
    `);
    if (updatedCount !== 1) return null;

    const row = await tx.schoolYearEnrollment.findUnique({
      where: { id: parent.id },
      include: parentInclude,
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async cancelChildrenIfUpcoming(
    children: Enrollment[],
    referenceDate: Date,
    tx: AppTransactionClient,
  ): Promise<Enrollment[] | null> {
    const persisted: Enrollment[] = [];
    for (const child of children) {
      void referenceDate;
      const updatedCount = await tx.$executeRaw(Prisma.sql`
        UPDATE enrollment
        SET cancelled_at = ${child.cancelledAt},
            cancellation_reason = ${child.cancellationReason},
            cancellation_note = ${child.cancellationNote},
            cancelled_by_user_id = ${child.cancelledByUserId}::uuid,
            cancelled_by_full_name = ${child.cancelledByFullName},
            historical_finalized_at = ${child.historicalFinalizedAt},
            updated_at = ${child.updatedAt}
        WHERE id = ${child.id}::uuid
          AND cancelled_at IS NULL
          AND enrollment_date > (clock_timestamp() AT TIME ZONE 'UTC')::date
      `);
      if (updatedCount !== 1) return null;

      const row = await tx.enrollment.findUnique({
        where: { id: child.id },
        include: childInclude,
      });
      if (!row) return null;
      persisted.push(PrismaEnrollmentMapper.toDomain(row));
    }
    return persisted;
  }

  async reconcileLifecycle(
    input: {
      schoolYearEnrollmentId: string;
      campusId: string;
      cancelledAt: Date;
      retention?: {
        retentionExpiresAt: Date;
        retentionPolicySource: string;
      };
    },
    tx: AppTransactionClient,
  ): Promise<EnrollmentCancellationLifecycleResult> {
    const candidates = await tx.schoolYearLifecycleCandidate.findMany({
      where: {
        campusId: input.campusId,
        sourceSchoolYearEnrollmentId: input.schoolYearEnrollmentId,
        committedAt: null,
        status: { not: "NO_LONGER_ELIGIBLE" },
      },
      select: { id: true, lifecycleRunId: true },
      orderBy: { id: "asc" },
    });
    const candidateIds = candidates.map((candidate) => candidate.id);
    if (candidateIds.length === 0) {
      return {
        noLongerEligibleCandidateIds: [],
        invalidatedPreviewIds: [],
      };
    }

    const previews = await tx.schoolYearLifecyclePreviewRun.findMany({
      where: {
        campusId: input.campusId,
        status: { in: ["VALID", "COMMITTING"] },
        candidates: { some: { candidateId: { in: candidateIds } } },
      },
      select: { id: true },
      orderBy: { id: "asc" },
    });
    const previewIds = previews.map((preview) => preview.id);

    const updatedCandidates = await tx.schoolYearLifecycleCandidate.updateMany({
      where: {
        id: { in: candidateIds },
        committedAt: null,
        status: { not: "NO_LONGER_ELIGIBLE" },
      },
      data: {
        status: "NO_LONGER_ELIGIBLE",
        conflictCode: null,
        message: "SOURCE_REGISTRATION_CANCELLED",
        rowVersion: { increment: 1 },
        updatedAt: input.cancelledAt,
      },
    });
    if (updatedCandidates.count !== candidateIds.length) {
      throw new Error("LIFECYCLE_CANCELLATION_RECONCILIATION_CONFLICT");
    }
    if (previewIds.length > 0) {
      const updatedPreviews = await tx.schoolYearLifecyclePreviewRun.updateMany(
        {
          where: {
            id: { in: previewIds },
            status: { in: ["VALID", "COMMITTING"] },
          },
          data: {
            status: "INVALIDATED",
            invalidatedAt: input.cancelledAt,
          },
        },
      );
      if (updatedPreviews.count !== previewIds.length) {
        throw new Error("LIFECYCLE_CANCELLATION_RECONCILIATION_CONFLICT");
      }
    }

    const lifecycleRunIds = [
      ...new Set(candidates.map((candidate) => candidate.lifecycleRunId)),
    ];
    for (const lifecycleRunId of lifecycleRunIds) {
      const groups = await tx.schoolYearLifecycleCandidate.groupBy({
        by: ["status"],
        where: { lifecycleRunId, campusId: input.campusId },
        _count: { _all: true },
      });
      const eligibleCount = groups
        .filter((group) => group.status !== "NO_LONGER_ELIGIBLE")
        .reduce((sum, group) => sum + group._count._all, 0);
      const completeCount = groups
        .filter((group) =>
          ["COMMITTED", "ALREADY_APPLIED", "SKIPPED"].includes(group.status),
        )
        .reduce((sum, group) => sum + group._count._all, 0);
      if (eligibleCount !== completeCount) {
        continue;
      }
      await tx.schoolYearLifecycleRun.updateMany({
        where: {
          id: lifecycleRunId,
          campusId: input.campusId,
          status: {
            in: [
              "DRAFT",
              "IN_PROGRESS",
              "PARTIALLY_COMMITTED",
              "NEEDS_RECONCILIATION",
            ],
          },
        },
        data: {
          status: "COMPLETED",
          completedAt: input.cancelledAt,
          retentionExpiresAt: input.retention?.retentionExpiresAt,
          retentionPolicySource: input.retention?.retentionPolicySource,
          lastActivityAt: input.cancelledAt,
          version: { increment: 1 },
        },
      });
    }

    return {
      noLongerEligibleCandidateIds: candidateIds,
      invalidatedPreviewIds: previewIds,
    };
  }
}
