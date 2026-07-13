import { Injectable, Optional } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  CreateSchoolYearLifecycleRunInput,
  ExpireInactiveSchoolYearLifecycleRunInput,
  FinalizeSchoolYearLifecycleCommitAttemptInput,
  FindOrCreateSchoolYearLifecycleRunResult,
  ReconcileSchoolYearLifecycleCandidatesVersionedInput,
  SaveSchoolYearLifecycleDecisionsVersionedInput,
  SaveSchoolYearLifecycleCandidateInput,
  SaveSchoolYearLifecyclePreviewRunInput,
  SaveRunScopedSchoolYearLifecyclePreviewInput,
  SaveRunScopedSchoolYearLifecyclePreviewResult,
  SchoolYearLifecyclePreviewRun,
  SchoolYearLifecyclePreviewMembership,
  SchoolYearLifecycleRepository,
  SchoolYearLifecycleRetentionInput,
  SchoolYearLifecycleSourceCandidate,
  UpdateSchoolYearLifecycleRunVersionedInput,
} from "@/application/class-management/ports/school-year-lifecycle.repository";
import {
  AuditEventInput,
  AuditEventRecorderPort,
} from "@/application/audit/ports/audit-event-recorder.port";
import {
  ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES,
  deriveSchoolYearLifecycleRunStatusAfterCommit,
  SchoolYearLifecycleCandidate,
  SchoolYearLifecycleCandidateAggregate,
  SchoolYearLifecycleCandidateFilter,
  SchoolYearLifecycleCandidateListQuery,
  SchoolYearLifecycleCandidatePage,
  SchoolYearLifecycleCandidateStatus,
  SchoolYearLifecycleCommitAttemptResult,
  SchoolYearLifecycleCommitRowResult,
  SchoolYearLifecycleCommitAttemptStatus,
  SchoolYearLifecycleCommitStatus,
  SchoolYearLifecycleOutcome,
  SchoolYearLifecyclePreviewRunStatus,
  SchoolYearLifecycleRun,
  SchoolYearLifecycleRunStatus,
  SchoolYearLifecycleScopeType,
} from "@/application/class-management/school-year-lifecycle";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";

import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { toUtcDateOnly } from "@/domain/class-management/enrollment-effective-status";
import { PrismaSchoolYearEnrollmentMapper } from "../mapper/prisma-school-year-enrollment.mapper";
import { acquireSchoolYearEnrollmentAdvisoryLock } from "../advisory-lock";
import { PrismaService } from "../prisma.service";

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PrismaSchoolYearLifecycleRepository extends SchoolYearLifecycleRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly auditRecorder?: AuditEventRecorderPort,
  ) {
    super();
  }

  async findActiveRun(
    campusId: string,
    sourceSchoolYearId: string,
  ): Promise<SchoolYearLifecycleRun | null> {
    const row = await this.prisma.schoolYearLifecycleRun.findFirst({
      where: {
        campusId,
        sourceSchoolYearId,
        status: { in: [...ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES] },
      },
      orderBy: { createdAt: "desc" },
    });

    return row ? this.toRun(row) : null;
  }

  async findRunById(
    id: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleRun | null> {
    const row = await this.prisma.schoolYearLifecycleRun.findFirst({
      where: { id, campusId },
    });

    return row ? this.toRun(row) : null;
  }

  async findInactiveUncommittedRuns(
    inactiveBefore: Date,
    limit: number,
  ): Promise<SchoolYearLifecycleRun[]> {
    const rows = await this.prisma.schoolYearLifecycleRun.findMany({
      where: {
        firstCommittedAt: null,
        status: { in: ["SETUP_INCOMPLETE", "DRAFT", "IN_PROGRESS"] },
        lastActivityAt: { lte: inactiveBefore },
        previewRuns: { none: { status: "COMMITTING" } },
      },
      orderBy: [{ lastActivityAt: "asc" }, { id: "asc" }],
      take: Math.min(Math.max(limit, 1), 500),
    });
    return rows.map((row) => this.toRun(row));
  }

  async expireInactiveRun(
    input: ExpireInactiveSchoolYearLifecycleRunInput,
  ): Promise<SchoolYearLifecycleRun | null> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.schoolYearLifecycleRun.updateMany({
        where: {
          id: input.lifecycleRunId,
          campusId: input.campusId,
          version: input.expectedVersion,
          firstCommittedAt: null,
          status: { in: ["SETUP_INCOMPLETE", "DRAFT", "IN_PROGRESS"] },
          lastActivityAt: { lte: input.inactiveBefore },
          previewRuns: { none: { status: "COMMITTING" } },
        },
        data: {
          status: "EXPIRED",
          version: { increment: 1 },
          expiredAt: input.expiredAt,
          lastActivityAt: input.expiredAt,
          retentionExpiresAt: input.retention?.retentionExpiresAt,
          retentionPolicySource: input.retention?.retentionPolicySource,
        },
      });
      if (updated.count !== 1) {
        return null;
      }

      const expiringPreviews = await tx.schoolYearLifecyclePreviewRun.findMany({
        where: {
          lifecycleRunId: input.lifecycleRunId,
          campusId: input.campusId,
          status: "VALID",
        },
        select: { id: true },
      });
      await tx.schoolYearLifecyclePreviewRun.updateMany({
        where: {
          id: { in: expiringPreviews.map((preview) => preview.id) },
          campusId: input.campusId,
        },
        data: { status: "EXPIRED", invalidatedAt: input.expiredAt },
      });
      await tx.schoolYearLifecycleCandidate.updateMany({
        where: {
          lifecycleRunId: input.lifecycleRunId,
          campusId: input.campusId,
          committedAt: null,
          status: { in: ["PREVIEWED", "CONFLICT"] },
        },
        data: { status: "READY", conflictCode: null, message: null },
      });
      await this.recordAudit(input.audit, tx, {
        invalidatedPreviewIds: expiringPreviews.map((preview) => preview.id),
        retentionExpiresAt:
          input.retention?.retentionExpiresAt.toISOString() ?? null,
        retentionPolicySource: input.retention?.retentionPolicySource ?? null,
      });

      const row = await tx.schoolYearLifecycleRun.findUniqueOrThrow({
        where: { id: input.lifecycleRunId },
      });
      return this.toRun(row);
    });
  }

  async findOrCreateRun(
    input: CreateSchoolYearLifecycleRunInput,
    initialCandidates: SaveSchoolYearLifecycleCandidateInput[] = [],
  ): Promise<FindOrCreateSchoolYearLifecycleRunResult> {
    const activeRun = await this.findActiveRun(
      input.campusId,
      input.sourceSchoolYearId,
    );
    if (activeRun) {
      return { run: activeRun, created: false };
    }

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const createdRun = await tx.schoolYearLifecycleRun.create({
          data: {
            id: input.id,
            campusId: input.campusId,
            sourceSchoolYearId: input.sourceSchoolYearId,
            targetSchoolYearId: input.targetSchoolYearId,
            sourceClosureDate: input.sourceClosureDate,
            targetEnrollmentDate: input.targetEnrollmentDate,
            createdByUserId: input.createdByUserId,
          },
        });

        if (initialCandidates.length > 0) {
          await tx.schoolYearLifecycleCandidate.createMany({
            data: initialCandidates.map((candidate) => ({
              ...candidate,
              lifecycleRunId: createdRun.id,
            })),
          });
        }

        await this.recordAudit(input.audit, tx, {
          lifecycleRunId: createdRun.id,
          candidateCount: initialCandidates.length,
        });

        return createdRun;
      });

      return { run: this.toRun(row), created: true };
    } catch (error) {
      if (!this.isUniqueConstraintError(error)) {
        throw error;
      }

      const competingRun = await this.findActiveRun(
        input.campusId,
        input.sourceSchoolYearId,
      );
      if (!competingRun) {
        throw error;
      }

      return { run: competingRun, created: false };
    }
  }

  async updateRunVersioned(
    input: UpdateSchoolYearLifecycleRunVersionedInput,
  ): Promise<SchoolYearLifecycleRun | null> {
    return this.prisma.$transaction(async (tx) => {
      const invalidatedPreviews = input.invalidatePreviews
        ? await tx.schoolYearLifecyclePreviewRun.findMany({
            where: {
              lifecycleRunId: input.id,
              campusId: input.campusId,
              status: "VALID",
            },
            select: { id: true },
          })
        : [];
      const result = await tx.schoolYearLifecycleRun.updateMany({
        where: {
          id: input.id,
          campusId: input.campusId,
          version: input.expectedVersion,
        },
        data: {
          sourceClosureDate: input.sourceClosureDate,
          targetEnrollmentDate: input.targetEnrollmentDate,
          targetSchoolYearId: input.targetSchoolYearId,
          status: input.status,
          firstCommittedAt: input.firstCommittedAt,
          completedAt: input.completedAt,
          cancelledAt: input.cancelledAt,
          expiredAt: input.expiredAt,
          retentionExpiresAt: input.retention?.retentionExpiresAt,
          retentionPolicySource: input.retention?.retentionPolicySource,
          lastActivityAt: input.lastActivityAt ?? new Date(),
          updatedByUserId: input.updatedByUserId,
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        return null;
      }

      if (input.invalidatePreviews) {
        await tx.schoolYearLifecyclePreviewRun.updateMany({
          where: {
            lifecycleRunId: input.id,
            campusId: input.campusId,
            status: "VALID",
          },
          data: { status: "INVALIDATED", invalidatedAt: new Date() },
        });
        await tx.schoolYearLifecycleCandidate.updateMany({
          where: {
            lifecycleRunId: input.id,
            campusId: input.campusId,
            status: { in: ["PREVIEWED", "CONFLICT"] },
            committedAt: null,
          },
          data: { status: "READY", conflictCode: null, message: null },
        });
      }

      if (input.resetTargetAssignments) {
        await tx.schoolYearLifecycleCandidate.updateMany({
          where: {
            lifecycleRunId: input.id,
            campusId: input.campusId,
            committedAt: null,
            decision: { in: ["PROMOTE", "RETAIN"] },
          },
          data: {
            targetClassId: null,
            status: "NEEDS_ACTION",
            rowVersion: { increment: 1 },
          },
        });
      }

      await this.recordAudit(input.audit, tx, {
        invalidatedPreviewIds: invalidatedPreviews.map((preview) => preview.id),
        retentionExpiresAt:
          input.retention?.retentionExpiresAt.toISOString() ?? null,
        retentionPolicySource: input.retention?.retentionPolicySource ?? null,
      });

      const updated = await tx.schoolYearLifecycleRun.findFirst({
        where: { id: input.id, campusId: input.campusId },
      });

      return updated ? this.toRun(updated) : null;
    });
  }

  async saveInitialCandidates(
    inputs: SaveSchoolYearLifecycleCandidateInput[],
    tx?: AppTransactionClient,
  ): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    const client = tx ?? this.prisma;
    const result = await client.schoolYearLifecycleCandidate.createMany({
      data: inputs,
      skipDuplicates: true,
    });
    return result.count;
  }

  async findCandidatesByRunId(
    lifecycleRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleCandidate[]> {
    const rows = await this.prisma.schoolYearLifecycleCandidate.findMany({
      where: { lifecycleRunId, campusId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });

    return rows.map((row) => this.toCandidate(row));
  }

  async findCandidatePage(
    lifecycleRunId: string,
    campusId: string,
    query: SchoolYearLifecycleCandidateListQuery,
  ): Promise<SchoolYearLifecycleCandidatePage> {
    const where = this.buildCandidateWhere(lifecycleRunId, campusId, query);
    const orderBy = this.buildCandidateOrderBy(query);
    const [rows, count] = await Promise.all([
      this.prisma.schoolYearLifecycleCandidate.findMany({
        where,
        include: {
          student: { select: { studentCode: true, fullName: true } },
          sourceSchoolYearEnrollment: {
            select: {
              snapshotStudentCode: true,
              snapshotStudentFullName: true,
            },
          },
          sourceGradeLevel: { select: { name: true, order: true } },
          sourceClass: { select: { name: true } },
          targetClass: { select: { name: true } },
        },
        orderBy,
        skip: query.offset,
        take: query.limit,
      }),
      this.prisma.schoolYearLifecycleCandidate.count({ where }),
    ]);
    const totalPages = count === 0 ? 0 : Math.ceil(count / query.limit);
    const currentPage = Math.floor(query.offset / query.limit) + 1;

    return {
      data: rows.map((row) => ({
        id: row.id,
        lifecycleRunId: row.lifecycleRunId,
        studentId: row.studentId,
        studentCode:
          row.student.studentCode ??
          row.sourceSchoolYearEnrollment.snapshotStudentCode ??
          "",
        studentName:
          row.student.fullName ??
          row.sourceSchoolYearEnrollment.snapshotStudentFullName ??
          "",
        sourceSchoolYearEnrollmentId: row.sourceSchoolYearEnrollmentId,
        sourceEnrollmentId: row.sourceEnrollmentId,
        sourceGradeLevelId: row.sourceGradeLevelId,
        sourceGradeLevelName: row.sourceGradeLevel.name,
        sourceGradeLevelOrder: row.sourceGradeLevel.order,
        sourceClassId: row.sourceClassId,
        sourceClassName: row.sourceClass?.name ?? null,
        status: row.status as SchoolYearLifecycleCandidateStatus,
        recommendedOutcome:
          row.recommendedOutcome as SchoolYearLifecycleOutcome,
        decision: row.decision as SchoolYearLifecycleOutcome | null,
        targetGradeLevelId: row.targetGradeLevelId,
        targetClassId: row.targetClassId,
        targetClassName: row.targetClass?.name ?? null,
        decisionNote: row.decisionNote,
        conflictCode:
          row.conflictCode as SchoolYearLifecycleCandidatePage["data"][number]["conflictCode"],
        message: row.message,
        rowVersion: row.rowVersion,
        decisionUpdatedByUserId: row.decisionUpdatedByUserId,
        decisionUpdatedAt: row.decisionUpdatedAt,
        committedAt: row.committedAt,
        updatedAt: row.updatedAt,
      })),
      pagination: {
        count,
        limit: query.limit,
        offset: query.offset,
        totalPages,
        currentPage,
        hasNext: query.offset + query.limit < count,
        hasPrev: query.offset > 0,
      },
    };
  }

  async findCandidatesByIds(
    lifecycleRunId: string,
    campusId: string,
    candidateIds: string[],
  ): Promise<SchoolYearLifecycleCandidate[]> {
    if (candidateIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.schoolYearLifecycleCandidate.findMany({
      where: { lifecycleRunId, campusId, id: { in: candidateIds } },
      orderBy: { id: "asc" },
    });
    return rows.map((row) => this.toCandidate(row));
  }

  async findCandidatesByFilter(
    lifecycleRunId: string,
    campusId: string,
    filter: SchoolYearLifecycleCandidateFilter,
  ): Promise<SchoolYearLifecycleCandidate[]> {
    const rows = await this.prisma.schoolYearLifecycleCandidate.findMany({
      where: this.buildCandidateWhere(lifecycleRunId, campusId, filter),
      orderBy: [{ sourceGradeLevel: { order: "asc" } }, { id: "asc" }],
    });
    return rows.map((row) => this.toCandidate(row));
  }

  async findCandidatesBySourceClassIds(
    lifecycleRunId: string,
    campusId: string,
    sourceClassIds: string[],
  ): Promise<SchoolYearLifecycleCandidate[]> {
    if (sourceClassIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.schoolYearLifecycleCandidate.findMany({
      where: {
        lifecycleRunId,
        campusId,
        sourceClassId: { in: sourceClassIds },
      },
      orderBy: [
        { sourceGradeLevel: { order: "asc" } },
        { sourceClass: { name: "asc" } },
        { student: { fullName: "asc" } },
        { studentId: "asc" },
      ],
    });
    return rows.map((row) => this.toCandidate(row));
  }

  async reconcileCandidatesVersioned(
    input: ReconcileSchoolYearLifecycleCandidatesVersionedInput,
  ): Promise<SchoolYearLifecycleRun | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const runUpdate = await tx.schoolYearLifecycleRun.updateMany({
          where: {
            id: input.lifecycleRunId,
            campusId: input.campusId,
            version: input.expectedVersion,
            status: { in: [...ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES] },
          },
          data: {
            version: { increment: 1 },
            updatedByUserId: input.updatedByUserId,
            lastActivityAt: new Date(),
          },
        });
        if (runUpdate.count !== 1) {
          return null;
        }

        const sources = [...input.inserts, ...input.updates];
        const parentIds = [
          ...new Set(
            sources.map((source) => source.sourceSchoolYearEnrollmentId),
          ),
        ];
        const childIds = [
          ...new Set(
            sources
              .map((source) => source.sourceEnrollmentId)
              .filter((id): id is string => id !== null),
          ),
        ];
        const lockedParents =
          parentIds.length === 0
            ? []
            : await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              SELECT id
              FROM school_year_enrollment
              WHERE id IN (${Prisma.join(parentIds.map((id) => Prisma.sql`${id}::uuid`))})
                AND campus_id = ${input.campusId}::uuid
                AND cancelled_at IS NULL
              FOR UPDATE
            `);
        const lockedChildren =
          childIds.length === 0
            ? []
            : await tx.$queryRaw<
                Array<{ id: string; schoolYearEnrollmentId: string }>
              >(Prisma.sql`
              SELECT id, school_year_enrollment_id AS "schoolYearEnrollmentId"
              FROM enrollment
              WHERE id IN (${Prisma.join(childIds.map((id) => Prisma.sql`${id}::uuid`))})
                AND cancelled_at IS NULL
              FOR UPDATE
            `);
        const lockedParentIds = new Set(lockedParents.map((row) => row.id));
        const lockedChildParents = new Map(
          lockedChildren.map((row) => [row.id, row.schoolYearEnrollmentId]),
        );
        if (
          sources.some(
            (source) =>
              !lockedParentIds.has(source.sourceSchoolYearEnrollmentId) ||
              (source.sourceEnrollmentId !== null &&
                lockedChildParents.get(source.sourceEnrollmentId) !==
                  source.sourceSchoolYearEnrollmentId),
          )
        ) {
          throw new Error("LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT");
        }

        if (input.inserts.length > 0) {
          const inserted = await tx.schoolYearLifecycleCandidate.createMany({
            data: input.inserts,
            skipDuplicates: true,
          });
          if (inserted.count !== input.inserts.length) {
            throw new Error("LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT");
          }
        }

        for (const batch of this.chunk(input.updates, 100)) {
          const results = await Promise.all(
            batch.map((candidate) =>
              tx.schoolYearLifecycleCandidate.updateMany({
                where: {
                  id: candidate.id,
                  lifecycleRunId: input.lifecycleRunId,
                  campusId: input.campusId,
                  committedAt: null,
                  status: { not: "NO_LONGER_ELIGIBLE" },
                  sourceSchoolYearEnrollment: { cancelledAt: null },
                  OR: [
                    { sourceEnrollmentId: null },
                    { sourceEnrollment: { cancelledAt: null } },
                  ],
                },
                data: {
                  sourceSchoolYearEnrollmentId:
                    candidate.sourceSchoolYearEnrollmentId,
                  sourceEnrollmentId: candidate.sourceEnrollmentId,
                  sourceGradeLevelId: candidate.sourceGradeLevelId,
                  sourceClassId: candidate.sourceClassId,
                  status: candidate.status,
                  recommendedOutcome: candidate.recommendedOutcome,
                  decision: candidate.decision,
                  targetGradeLevelId: candidate.targetGradeLevelId,
                  targetClassId: candidate.targetClassId,
                  conflictCode: null,
                  message: null,
                  rowVersion: { increment: 1 },
                },
              }),
            ),
          );
          if (results.some((result) => result.count !== 1)) {
            throw new Error("LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT");
          }
        }

        const changedCandidateIds = input.updates.map(
          (candidate) => candidate.id,
        );
        const invalidatedPreviews =
          changedCandidateIds.length > 0
            ? await tx.schoolYearLifecyclePreviewRun.findMany({
                where: {
                  lifecycleRunId: input.lifecycleRunId,
                  campusId: input.campusId,
                  status: "VALID",
                  candidates: {
                    some: { candidateId: { in: changedCandidateIds } },
                  },
                },
                select: { id: true },
              })
            : [];
        if (changedCandidateIds.length > 0) {
          await tx.schoolYearLifecyclePreviewRun.updateMany({
            where: {
              lifecycleRunId: input.lifecycleRunId,
              campusId: input.campusId,
              status: "VALID",
              candidates: {
                some: { candidateId: { in: changedCandidateIds } },
              },
            },
            data: { status: "INVALIDATED", invalidatedAt: new Date() },
          });
        }

        await this.recordAudit(input.audit, tx, {
          invalidatedPreviewIds: invalidatedPreviews.map(
            (preview) => preview.id,
          ),
        });

        const run = await tx.schoolYearLifecycleRun.findFirst({
          where: { id: input.lifecycleRunId, campusId: input.campusId },
        });
        return run ? this.toRun(run) : null;
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT"
      ) {
        return null;
      }
      throw error;
    }
  }

  async saveDecisionsVersioned(
    input: SaveSchoolYearLifecycleDecisionsVersionedInput,
  ): Promise<SchoolYearLifecycleRun | null> {
    return this.prisma.$transaction(async (tx) => {
      const runUpdate = await tx.schoolYearLifecycleRun.updateMany({
        where: {
          id: input.lifecycleRunId,
          campusId: input.campusId,
          version: input.expectedVersion,
          status: { in: [...ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES] },
        },
        data: {
          version: { increment: 1 },
          updatedByUserId: input.updatedByUserId,
          lastActivityAt: new Date(),
        },
      });
      if (runUpdate.count !== 1) {
        return null;
      }

      for (const batch of this.chunk(input.decisions, 100)) {
        const results = await Promise.all(
          batch.map((decision) =>
            tx.schoolYearLifecycleCandidate.updateMany({
              where: {
                id: decision.candidateId,
                lifecycleRunId: input.lifecycleRunId,
                campusId: input.campusId,
                committedAt: null,
                status: { not: "NO_LONGER_ELIGIBLE" },
              },
              data: {
                decision: decision.decision,
                targetGradeLevelId: decision.targetGradeLevelId,
                targetClassId: decision.targetClassId,
                decisionNote: decision.decisionNote,
                decisionUpdatedByUserId: input.updatedByUserId,
                decisionUpdatedAt: new Date(),
                status: decision.status,
                conflictCode: null,
                message: null,
                rowVersion: { increment: 1 },
              },
            }),
          ),
        );
        if (results.some((result) => result.count !== 1)) {
          throw new Error("LIFECYCLE_DECISION_ATOMICITY_CONFLICT");
        }
      }

      const candidateIds = input.decisions.map(
        (decision) => decision.candidateId,
      );
      const invalidatedPreviews =
        await tx.schoolYearLifecyclePreviewRun.findMany({
          where: {
            lifecycleRunId: input.lifecycleRunId,
            campusId: input.campusId,
            status: "VALID",
            expiresAt: { gt: new Date() },
            candidates: { some: { candidateId: { in: candidateIds } } },
          },
          select: { id: true },
        });
      await tx.schoolYearLifecyclePreviewRun.updateMany({
        where: {
          lifecycleRunId: input.lifecycleRunId,
          campusId: input.campusId,
          status: "VALID",
          expiresAt: { gt: new Date() },
          candidates: { some: { candidateId: { in: candidateIds } } },
        },
        data: { status: "INVALIDATED", invalidatedAt: new Date() },
      });
      await this.recordAudit(input.audit, tx, {
        invalidatedPreviewIds: invalidatedPreviews.map((preview) => preview.id),
      });

      const run = await tx.schoolYearLifecycleRun.findFirst({
        where: { id: input.lifecycleRunId, campusId: input.campusId },
      });
      return run ? this.toRun(run) : null;
    });
  }

  async findCandidateAggregates(
    lifecycleRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecycleCandidateAggregate[]> {
    const groups = await this.prisma.schoolYearLifecycleCandidate.groupBy({
      by: [
        "sourceGradeLevelId",
        "sourceClassId",
        "status",
        "decision",
        "targetClassId",
      ],
      where: { lifecycleRunId, campusId },
      _count: { _all: true },
    });
    const gradeLevelIds = [
      ...new Set(groups.map((row) => row.sourceGradeLevelId)),
    ];
    const classIds = [
      ...new Set(
        groups
          .map((row) => row.sourceClassId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [gradeLevels, classes] = await Promise.all([
      this.prisma.gradeLevel.findMany({
        where: { campusId, id: { in: gradeLevelIds } },
        select: { id: true, name: true, order: true },
      }),
      this.prisma.class.findMany({
        where: { campusId, id: { in: classIds } },
        select: { id: true, name: true },
      }),
    ]);
    const gradeById = new Map(gradeLevels.map((row) => [row.id, row]));
    const classById = new Map(classes.map((row) => [row.id, row]));

    return groups.map((row) => ({
      sourceGradeLevelId: row.sourceGradeLevelId,
      sourceGradeLevelName: gradeById.get(row.sourceGradeLevelId)?.name ?? null,
      sourceGradeLevelOrder:
        gradeById.get(row.sourceGradeLevelId)?.order ?? null,
      sourceClassId: row.sourceClassId,
      sourceClassName: row.sourceClassId
        ? (classById.get(row.sourceClassId)?.name ?? null)
        : null,
      status: row.status as SchoolYearLifecycleCandidateStatus,
      decision: row.decision as SchoolYearLifecycleOutcome | null,
      targetClassId: row.targetClassId,
      count: row._count._all,
    }));
  }

  async findOpenSourceCandidates(
    campusId: string,
    sourceSchoolYearId: string,
    studentIds?: string[],
    effectiveDate?: Date,
  ): Promise<SchoolYearLifecycleSourceCandidate[]> {
    if (studentIds && studentIds.length === 0) {
      return [];
    }

    const date = effectiveDate ? toUtcDateOnly(effectiveDate) : undefined;
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: {
        campusId,
        schoolYearId: sourceSchoolYearId,
        cancelledAt: null,
        ...(date
          ? {
              enrollmentDate: { lte: date },
              OR: [{ exitDate: null }, { exitDate: { gte: date } }],
            }
          : { exitDate: null }),
        ...(studentIds ? { studentId: { in: studentIds } } : {}),
      },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
        enrollments: {
          where: {
            cancelledAt: null,
            ...(date
              ? {
                  enrollmentDate: { lte: date },
                  OR: [{ endDate: null }, { endDate: { gte: date } }],
                }
              : { endDate: null }),
            class: { schoolYearId: sourceSchoolYearId },
          },
          include: {
            class: { include: { schoolYear: true, gradeLevel: true } },
            student: true,
          },
          orderBy: { enrollmentDate: "desc" },
          take: 1,
        },
      },
      orderBy: [
        { gradeLevel: { order: "asc" } },
        { student: { fullName: "asc" } },
        { enrollmentDate: "asc" },
      ],
    });

    return rows.map((row) => ({
      schoolYearEnrollment: PrismaSchoolYearEnrollmentMapper.toDomain(row),
      activeEnrollment:
        row.enrollments.length > 0
          ? PrismaEnrollmentMapper.toDomain(row.enrollments[0])
          : null,
    }));
  }

  async findOpenTargetRegistrationStudentIds(
    campusId: string,
    targetSchoolYearId: string,
    studentIds: string[],
  ): Promise<string[]> {
    if (studentIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: {
        campusId,
        schoolYearId: targetSchoolYearId,
        studentId: { in: studentIds },
        cancelledAt: null,
        exitDate: null,
      },
      select: { studentId: true },
      orderBy: { studentId: "asc" },
    });
    return rows.map((row) => row.studentId);
  }

  async findCancelledTargetRegistrationStudentIds(
    campusId: string,
    targetSchoolYearId: string,
    studentIds: string[],
  ): Promise<string[]> {
    if (studentIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: {
        campusId,
        schoolYearId: targetSchoolYearId,
        studentId: { in: studentIds },
        cancelledAt: { not: null },
      },
      select: { studentId: true },
      distinct: ["studentId"],
      orderBy: { studentId: "asc" },
    });
    return rows.map((row) => row.studentId);
  }

  async findPreviewRunById(
    id: string,
    campusId: string,
  ): Promise<SchoolYearLifecyclePreviewRun | null> {
    const row = await this.prisma.schoolYearLifecyclePreviewRun.findFirst({
      where: { id, campusId },
    });
    return row ? this.toPreviewRun(row) : null;
  }

  async savePreviewRun(
    input: SaveSchoolYearLifecyclePreviewRunInput,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearLifecyclePreviewRun> {
    const client = tx ?? this.prisma;
    const row = await client.schoolYearLifecyclePreviewRun.create({
      data: {
        id: input.id,
        lifecycleRunId: input.lifecycleRunId,
        runVersion: input.runVersion,
        campusId: input.campusId,
        sourceSchoolYearId: input.sourceSchoolYearId,
        targetSchoolYearId: input.targetSchoolYearId,
        sourceClosureDate: input.sourceClosureDate,
        targetEnrollmentDate: input.targetEnrollmentDate,
        digest: input.digest,
        requestPayload: input.requestPayload as Prisma.InputJsonValue,
        resultPayload: input.resultPayload as Prisma.InputJsonValue,
        scopeType: input.scopeType,
        scopeIdentity: input.scopeIdentity,
        scopePayload: input.scopePayload as Prisma.InputJsonValue | undefined,
        status: input.status,
        expiresAt: input.expiresAt ?? new Date(Date.now() + PREVIEW_TTL_MS),
        createdByUserId: input.createdByUserId,
      },
    });
    return this.toPreviewRun(row);
  }

  async saveRunScopedPreview(
    input: SaveRunScopedSchoolYearLifecyclePreviewInput,
  ): Promise<SaveRunScopedSchoolYearLifecyclePreviewResult | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await tx.schoolYearLifecycleRun.findFirst({
          where: {
            id: input.lifecycleRunId,
            campusId: input.campusId,
            version: input.runVersion,
            status: { in: [...ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES] },
          },
          select: { id: true },
        });
        if (!run) {
          return null;
        }

        const candidateIds = input.candidates.map(
          (candidate) => candidate.candidateId,
        );
        const overlapping = await tx.schoolYearLifecyclePreviewRun.findMany({
          where: {
            lifecycleRunId: input.lifecycleRunId,
            campusId: input.campusId,
            status: "VALID",
            candidates: { some: { candidateId: { in: candidateIds } } },
          },
          select: {
            id: true,
            candidates: { select: { candidateId: true } },
          },
        });
        const supersededPreviewIds = overlapping.map((preview) => preview.id);
        const supersededCandidateIds = [
          ...new Set(
            overlapping.flatMap((preview) =>
              preview.candidates.map((candidate) => candidate.candidateId),
            ),
          ),
        ];
        if (supersededPreviewIds.length > 0) {
          await tx.schoolYearLifecyclePreviewRun.updateMany({
            where: {
              id: { in: supersededPreviewIds },
              campusId: input.campusId,
            },
            data: { status: "SUPERSEDED", supersededAt: new Date() },
          });
          await tx.schoolYearLifecycleCandidate.updateMany({
            where: {
              id: { in: supersededCandidateIds },
              lifecycleRunId: input.lifecycleRunId,
              campusId: input.campusId,
              status: { in: ["PREVIEWED", "CONFLICT"] },
            },
            data: { status: "READY", conflictCode: null, message: null },
          });
        }

        const created = await tx.schoolYearLifecyclePreviewRun.create({
          data: {
            id: input.id,
            lifecycleRunId: input.lifecycleRunId,
            runVersion: input.runVersion,
            campusId: input.campusId,
            sourceSchoolYearId: input.sourceSchoolYearId,
            targetSchoolYearId: input.targetSchoolYearId,
            sourceClosureDate: input.sourceClosureDate,
            targetEnrollmentDate: input.targetEnrollmentDate,
            digest: input.digest,
            requestPayload: input.requestPayload as Prisma.InputJsonValue,
            resultPayload: input.resultPayload as Prisma.InputJsonValue,
            scopeType: input.scopeType,
            scopeIdentity: input.scopeIdentity,
            scopePayload: input.scopePayload as Prisma.InputJsonValue,
            status: input.status ?? "VALID",
            expiresAt: input.expiresAt,
            createdByUserId: input.createdByUserId,
            candidates: {
              create: input.candidates.map((candidate) => ({
                candidateId: candidate.candidateId,
                sequence: candidate.sequence,
                normalizedRow: candidate.normalizedRow as Prisma.InputJsonValue,
              })),
            },
          },
        });

        for (const batch of this.chunk(input.candidates, 100)) {
          const results = await Promise.all(
            batch.map((candidate) =>
              tx.schoolYearLifecycleCandidate.updateMany({
                where: {
                  id: candidate.candidateId,
                  lifecycleRunId: input.lifecycleRunId,
                  campusId: input.campusId,
                  committedAt: null,
                  status: { not: "NO_LONGER_ELIGIBLE" },
                  sourceSchoolYearEnrollment: { cancelledAt: null },
                  OR: [
                    { sourceEnrollmentId: null },
                    { sourceEnrollment: { cancelledAt: null } },
                  ],
                },
                data: {
                  status: candidate.status,
                  conflictCode: candidate.conflictCode,
                  message: candidate.message,
                },
              }),
            ),
          );
          if (results.some((result) => result.count !== 1)) {
            throw new Error("LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT");
          }
        }
        await tx.schoolYearLifecycleRun.update({
          where: { id: input.lifecycleRunId },
          data: { lastActivityAt: new Date() },
        });

        await this.recordAudit(input.audit, tx, {
          previewRunId: created.id,
          supersededPreviewIds,
        });

        return {
          previewRun: this.toPreviewRun(created),
          supersededPreviewIds,
        };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT"
      ) {
        return null;
      }
      throw error;
    }
  }

  async findPreviewMemberships(
    previewRunId: string,
    campusId: string,
  ): Promise<SchoolYearLifecyclePreviewMembership[]> {
    const rows = await this.prisma.schoolYearLifecyclePreviewCandidate.findMany(
      {
        where: { previewRunId, previewRun: { campusId } },
        include: { candidate: { select: { studentId: true } } },
        orderBy: { sequence: "asc" },
      },
    );
    return rows.map((row) => ({
      candidateId: row.candidateId,
      studentId: row.candidate.studentId,
      sequence: row.sequence,
      normalizedRow: row.normalizedRow,
    }));
  }

  async startCommitAttempt(input: {
    lifecycleRunId: string;
    previewRunId: string;
    runVersion: number;
    campusId: string;
    createdByUserId: string;
  }): Promise<string | null> {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.schoolYearLifecyclePreviewRun.updateMany({
        where: {
          id: input.previewRunId,
          lifecycleRunId: input.lifecycleRunId,
          campusId: input.campusId,
          status: "VALID",
          expiresAt: { gt: new Date() },
          lifecycleRun: {
            version: input.runVersion,
            status: { in: [...ACTIVE_SCHOOL_YEAR_LIFECYCLE_RUN_STATUSES] },
          },
          candidates: {
            every: {
              candidate: {
                committedAt: null,
                status: { not: "NO_LONGER_ELIGIBLE" },
                sourceSchoolYearEnrollment: { cancelledAt: null },
                OR: [
                  { sourceEnrollmentId: null },
                  { sourceEnrollment: { cancelledAt: null } },
                ],
              },
            },
          },
        },
        data: { status: "COMMITTING" },
      });
      if (locked.count !== 1) {
        return null;
      }
      const attempt = await tx.schoolYearLifecycleCommitAttempt.create({
        data: {
          lifecycleRunId: input.lifecycleRunId,
          previewRunId: input.previewRunId,
          campusId: input.campusId,
          createdByUserId: input.createdByUserId,
        },
        select: { id: true },
      });
      await tx.schoolYearLifecycleRun.update({
        where: { id: input.lifecycleRunId },
        data: { lastActivityAt: new Date() },
      });
      return attempt.id;
    });
  }

  async finalizeCommitAttempt(
    input: FinalizeSchoolYearLifecycleCommitAttemptInput,
  ): Promise<{
    attempt: SchoolYearLifecycleCommitAttemptResult;
    run: SchoolYearLifecycleRun;
  }> {
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.schoolYearLifecycleCommitAttempt.findFirst({
        where: {
          id: input.commitAttemptId,
          lifecycleRunId: input.lifecycleRunId,
          previewRunId: input.previewRunId,
          campusId: input.campusId,
          status: "RUNNING",
        },
        select: { id: true },
      });
      if (!attempt) {
        throw new Error("COMMIT_ATTEMPT_NOT_RUNNING");
      }

      const completedAt = new Date();
      const candidateIds = input.rows.map(({ candidateId }) => candidateId);
      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM school_year_lifecycle_candidate
        WHERE id IN (${Prisma.join(candidateIds.map((id) => Prisma.sql`${id}::uuid`))})
          AND lifecycle_run_id = ${input.lifecycleRunId}::uuid
          AND campus_id = ${input.campusId}::uuid
        FOR UPDATE
      `);
      const currentCandidates = await tx.schoolYearLifecycleCandidate.findMany({
        where: {
          id: { in: candidateIds },
          lifecycleRunId: input.lifecycleRunId,
          campusId: input.campusId,
        },
        select: { id: true, status: true, committedAt: true },
      });
      const excludedCandidateIds = new Set(
        currentCandidates
          .filter(
            (candidate) =>
              candidate.status === "NO_LONGER_ELIGIBLE" &&
              candidate.committedAt === null,
          )
          .map((candidate) => candidate.id),
      );
      const effectiveRows = input.rows.filter(
        ({ candidateId }) => !excludedCandidateIds.has(candidateId),
      );
      const successfulCandidateIds = effectiveRows
        .filter(({ result }) => result.status === "SUCCESS")
        .map(({ candidateId }) => candidateId);
      const persistedSuccessRows =
        successfulCandidateIds.length === 0
          ? []
          : await tx.schoolYearLifecycleCommitRowResult.findMany({
              where: {
                commitAttemptId: input.commitAttemptId,
                lifecycleCandidateId: { in: successfulCandidateIds },
                status: "SUCCESS",
              },
              select: { lifecycleCandidateId: true },
            });
      const persistedSuccessIds = new Set(
        persistedSuccessRows.map((row) => row.lifecycleCandidateId),
      );
      const rowsToPersist = input.rows.filter(
        ({ candidateId, result }) =>
          result.status !== "SUCCESS" || !persistedSuccessIds.has(candidateId),
      );
      if (rowsToPersist.length > 0) {
        await tx.schoolYearLifecycleCommitRowResult.createMany({
          data: rowsToPersist.map(({ candidateId, result }) => ({
            commitAttemptId: input.commitAttemptId,
            lifecycleCandidateId: candidateId,
            campusId: input.campusId,
            studentId: result.studentId,
            status: result.status,
            outcome: result.outcome,
            targetClassId: result.targetClassId,
            conflictCode: result.conflictCode,
            message: result.message,
            resultingSchoolYearEnrollmentId:
              result.context.targetSchoolYearEnrollmentId,
            resultingClassEnrollmentId: result.context.targetClassEnrollmentId,
            operations: result.operations as unknown as Prisma.InputJsonValue,
            context: result.context as unknown as Prisma.InputJsonValue,
          })),
        });
      }

      const rowsToFinalize = effectiveRows.filter(
        ({ candidateId, result }) =>
          result.status !== "SUCCESS" || !persistedSuccessIds.has(candidateId),
      );
      for (const batch of this.chunk(rowsToFinalize, 100)) {
        const results = await Promise.all(
          batch.map(({ candidateId, result }) => {
            const completed = [
              "SUCCESS",
              "ALREADY_APPLIED",
              "SKIPPED",
            ].includes(result.status);
            const status =
              result.status === "SUCCESS"
                ? "COMMITTED"
                : result.status === "ALREADY_APPLIED"
                  ? "ALREADY_APPLIED"
                  : result.status;
            return tx.schoolYearLifecycleCandidate.updateMany({
              where: {
                id: candidateId,
                lifecycleRunId: input.lifecycleRunId,
                campusId: input.campusId,
                committedAt: null,
                status: { not: "NO_LONGER_ELIGIBLE" },
              },
              data: {
                status,
                conflictCode: result.conflictCode,
                message: result.message,
                committedAt: completed ? completedAt : null,
                rowVersion: { increment: 1 },
              },
            });
          }),
        );
        if (results.some((result) => result.count !== 1)) {
          throw new Error("COMMIT_RESULT_ATOMICITY_CONFLICT");
        }
      }

      const successCount = input.rows.filter(
        ({ result }) => result.status === "SUCCESS",
      ).length;
      const failedCount = input.rows.filter(
        ({ result }) => result.status === "FAILED",
      ).length;
      const skippedCount = input.rows.filter(
        ({ result }) => result.status === "SKIPPED",
      ).length;
      const alreadyAppliedCount = input.rows.filter(
        ({ result }) => result.status === "ALREADY_APPLIED",
      ).length;
      await tx.schoolYearLifecycleCommitAttempt.update({
        where: { id: input.commitAttemptId },
        data: {
          status: failedCount > 0 ? "PARTIAL" : "COMPLETED",
          successCount,
          failedCount,
          skippedCount,
          alreadyAppliedCount,
          completedAt,
        },
      });
      await tx.schoolYearLifecyclePreviewRun.updateMany({
        where: {
          id: input.previewRunId,
          lifecycleRunId: input.lifecycleRunId,
          campusId: input.campusId,
          status: "COMMITTING",
        },
        data: { status: "FINALIZED", finalizedAt: completedAt },
      });

      const [candidateGroups, currentRun] = await Promise.all([
        tx.schoolYearLifecycleCandidate.groupBy({
          by: ["status"],
          where: {
            lifecycleRunId: input.lifecycleRunId,
            campusId: input.campusId,
          },
          _count: { _all: true },
        }),
        tx.schoolYearLifecycleRun.findFirstOrThrow({
          where: { id: input.lifecycleRunId, campusId: input.campusId },
        }),
      ]);
      const eligibleCount = candidateGroups
        .filter((group) => group.status !== "NO_LONGER_ELIGIBLE")
        .reduce((sum, group) => sum + group._count._all, 0);
      const completeCount = candidateGroups
        .filter((group) =>
          ["COMMITTED", "ALREADY_APPLIED", "SKIPPED"].includes(group.status),
        )
        .reduce((sum, group) => sum + group._count._all, 0);
      const hasSuccessfulCommit = successCount + alreadyAppliedCount > 0;
      const completed = eligibleCount === completeCount;
      const runStatus = deriveSchoolYearLifecycleRunStatusAfterCommit({
        eligibleCount,
        completeCount,
        hasPriorSuccessfulCommit: Boolean(currentRun.firstCommittedAt),
        successCount,
        alreadyAppliedCount,
        failedCount,
      });
      const updatedRun = await tx.schoolYearLifecycleRun.update({
        where: { id: input.lifecycleRunId },
        data: {
          status: runStatus,
          version: { increment: 1 },
          firstCommittedAt:
            currentRun.firstCommittedAt ??
            (hasSuccessfulCommit ? completedAt : undefined),
          completedAt: completed ? completedAt : null,
          retentionExpiresAt: completed
            ? input.retention?.retentionExpiresAt
            : undefined,
          retentionPolicySource: completed
            ? input.retention?.retentionPolicySource
            : undefined,
          lastActivityAt: completedAt,
        },
      });
      const persistedAttempt =
        await tx.schoolYearLifecycleCommitAttempt.findUniqueOrThrow({
          where: { id: input.commitAttemptId },
          include: {
            rowResults: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          },
        });

      return {
        attempt: this.toCommitAttempt(persistedAttempt),
        run: this.toRun(updatedRun),
      };
    });
  }

  async persistSuccessfulCommitRow(
    input: {
      commitAttemptId: string;
      lifecycleRunId: string;
      previewRunId: string;
      campusId: string;
      candidateId: string;
      result: SchoolYearLifecycleCommitRowResult;
    },
    tx: AppTransactionClient,
  ): Promise<void> {
    if (input.result.status !== "SUCCESS") {
      throw new Error("LIFECYCLE_SUCCESS_RESULT_REQUIRED");
    }
    const committedAt = new Date();
    const claimed = await tx.schoolYearLifecycleCandidate.updateMany({
      where: {
        id: input.candidateId,
        lifecycleRunId: input.lifecycleRunId,
        campusId: input.campusId,
        committedAt: null,
        status: { not: "NO_LONGER_ELIGIBLE" },
        previewMemberships: {
          some: {
            previewRunId: input.previewRunId,
            previewRun: { status: "COMMITTING" },
          },
        },
      },
      data: {
        status: "COMMITTED",
        conflictCode: null,
        message: null,
        committedAt,
        rowVersion: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      throw new Error("LIFECYCLE_CANDIDATE_ELIGIBILITY_CONFLICT");
    }
    const result = input.result;
    await tx.schoolYearLifecycleCommitRowResult.create({
      data: {
        commitAttemptId: input.commitAttemptId,
        lifecycleCandidateId: input.candidateId,
        campusId: input.campusId,
        studentId: result.studentId,
        status: result.status,
        outcome: result.outcome,
        targetClassId: result.targetClassId,
        conflictCode: result.conflictCode,
        message: result.message,
        resultingSchoolYearEnrollmentId:
          result.context.targetSchoolYearEnrollmentId,
        resultingClassEnrollmentId: result.context.targetClassEnrollmentId,
        operations: result.operations as unknown as Prisma.InputJsonValue,
        context: result.context as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async closeSourceEnrollmentsForCommit(
    parent: SchoolYearEnrollment,
    openChild: Enrollment | null,
    tx: AppTransactionClient,
  ): Promise<void> {
    const parentUpdate = await tx.schoolYearEnrollment.updateMany({
      where: {
        id: parent.id,
        campusId: parent.campusId,
        cancelledAt: null,
        exitDate: null,
      },
      data: PrismaSchoolYearEnrollmentMapper.toPrismaUpdate(parent),
    });
    if (parentUpdate.count !== 1) {
      const currentParent = await tx.schoolYearEnrollment.findUnique({
        where: { id: parent.id },
        select: { cancelledAt: true },
      });
      if (currentParent?.cancelledAt) {
        throw new Error("LIFECYCLE_SOURCE_REGISTRATION_CANCELLED");
      }
      throw new Error("LIFECYCLE_SOURCE_REGISTRATION_CHANGED");
    }
    if (!openChild) {
      return;
    }
    const childUpdate = await tx.enrollment.updateMany({
      where: {
        id: openChild.id,
        schoolYearEnrollmentId: parent.id,
        cancelledAt: null,
        endDate: null,
      },
      data: PrismaEnrollmentMapper.toPrismaUpdate(openChild),
    });
    if (childUpdate.count !== 1) {
      const currentChild = await tx.enrollment.findUnique({
        where: { id: openChild.id },
        select: { cancelledAt: true },
      });
      if (currentChild?.cancelledAt) {
        throw new Error("LIFECYCLE_SOURCE_REGISTRATION_CANCELLED");
      }
      throw new Error("LIFECYCLE_SOURCE_REGISTRATION_CHANGED");
    }
  }

  async assertTargetRegistrationCanBeCreated(
    studentId: string,
    targetSchoolYearId: string,
    tx: AppTransactionClient,
  ): Promise<void> {
    await acquireSchoolYearEnrollmentAdvisoryLock(
      tx,
      studentId,
      targetSchoolYearId,
    );
    const existing = await tx.schoolYearEnrollment.findFirst({
      where: { studentId, schoolYearId: targetSchoolYearId },
      select: { cancelledAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing?.cancelledAt) {
      throw new Error("CANCELLED_TARGET_REGISTRATION");
    }
    if (existing) {
      throw new Error("EXISTING_TARGET_REGISTRATION");
    }
  }

  async failCommitAttempt(
    commitAttemptId: string,
    previewRunId: string,
    campusId: string,
    retention?: SchoolYearLifecycleRetentionInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const attempt = await tx.schoolYearLifecycleCommitAttempt.findFirst({
        where: { id: commitAttemptId, campusId, status: "RUNNING" },
        select: {
          lifecycleRunId: true,
          rowResults: { select: { status: true } },
        },
      });
      if (!attempt) {
        return;
      }
      const completedAt = new Date();
      if (attempt.rowResults.length === 0) {
        await tx.schoolYearLifecycleCommitAttempt.update({
          where: { id: commitAttemptId },
          data: { status: "FAILED", completedAt },
        });
        await tx.schoolYearLifecyclePreviewRun.updateMany({
          where: { id: previewRunId, campusId, status: "COMMITTING" },
          data: { status: "VALID" },
        });
        return;
      }

      await tx.$queryRaw(Prisma.sql`
        SELECT id
        FROM school_year_lifecycle_candidate
        WHERE lifecycle_run_id = ${attempt.lifecycleRunId}::uuid
          AND campus_id = ${campusId}::uuid
        FOR UPDATE
      `);
      const groups = await tx.schoolYearLifecycleCandidate.groupBy({
        by: ["status"],
        where: { lifecycleRunId: attempt.lifecycleRunId, campusId },
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
      const completed = eligibleCount === completeCount;
      const successCount = attempt.rowResults.filter(
        (row) => row.status === "SUCCESS",
      ).length;
      const alreadyAppliedCount = attempt.rowResults.filter(
        (row) => row.status === "ALREADY_APPLIED",
      ).length;
      const skippedCount = attempt.rowResults.filter(
        (row) => row.status === "SKIPPED",
      ).length;
      const failedCount = attempt.rowResults.filter(
        (row) => row.status === "FAILED",
      ).length;
      const currentRun = await tx.schoolYearLifecycleRun.findFirstOrThrow({
        where: { id: attempt.lifecycleRunId, campusId },
      });
      const runStatus = deriveSchoolYearLifecycleRunStatusAfterCommit({
        eligibleCount,
        completeCount,
        hasPriorSuccessfulCommit: Boolean(currentRun.firstCommittedAt),
        successCount,
        alreadyAppliedCount,
        failedCount,
      });
      await tx.schoolYearLifecycleCommitAttempt.update({
        where: { id: commitAttemptId },
        data: {
          status: completed ? "COMPLETED" : "PARTIAL",
          successCount,
          failedCount,
          skippedCount,
          alreadyAppliedCount,
          completedAt,
        },
      });
      await tx.schoolYearLifecyclePreviewRun.updateMany({
        where: { id: previewRunId, campusId, status: "COMMITTING" },
        data: { status: "FINALIZED", finalizedAt: completedAt },
      });
      await tx.schoolYearLifecycleRun.update({
        where: { id: attempt.lifecycleRunId },
        data: {
          status: runStatus,
          version: { increment: 1 },
          firstCommittedAt: currentRun.firstCommittedAt ?? completedAt,
          completedAt: completed ? completedAt : null,
          retentionExpiresAt: completed
            ? retention?.retentionExpiresAt
            : undefined,
          retentionPolicySource: completed
            ? retention?.retentionPolicySource
            : undefined,
          lastActivityAt: completedAt,
        },
      });
    });
  }

  async findCommitAttempts(
    lifecycleRunId: string,
    campusId: string,
    limit: number,
  ): Promise<SchoolYearLifecycleCommitAttemptResult[]> {
    const rows = await this.prisma.schoolYearLifecycleCommitAttempt.findMany({
      where: { lifecycleRunId, campusId },
      include: {
        rowResults: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(Math.max(limit, 1), 50),
    });
    return rows.map((row) => this.toCommitAttempt(row));
  }

  private isUniqueConstraintError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private buildCandidateWhere(
    lifecycleRunId: string,
    campusId: string,
    filter: SchoolYearLifecycleCandidateFilter,
  ): Prisma.SchoolYearLifecycleCandidateWhereInput {
    return {
      lifecycleRunId,
      campusId,
      sourceGradeLevelId: filter.sourceGradeLevelId,
      sourceClassId:
        filter.sourceClassId === undefined ? undefined : filter.sourceClassId,
      status: filter.status,
      ...(filter.search
        ? {
            OR: [
              {
                student: {
                  fullName: { contains: filter.search, mode: "insensitive" },
                },
              },
              {
                student: {
                  studentCode: {
                    contains: filter.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                sourceSchoolYearEnrollment: {
                  snapshotStudentFullName: {
                    contains: filter.search,
                    mode: "insensitive",
                  },
                },
              },
              {
                sourceSchoolYearEnrollment: {
                  snapshotStudentCode: {
                    contains: filter.search,
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private buildCandidateOrderBy(
    query: SchoolYearLifecycleCandidateListQuery,
  ): Prisma.SchoolYearLifecycleCandidateOrderByWithRelationInput[] {
    const direction = query.sortOrder;
    switch (query.sortBy) {
      case "studentName":
        return [{ student: { fullName: direction } }, { studentId: "asc" }];
      case "studentCode":
        return [{ student: { studentCode: direction } }, { studentId: "asc" }];
      case "className":
        return [
          { sourceClass: { name: direction } },
          { student: { fullName: "asc" } },
          { studentId: "asc" },
        ];
      case "status":
        return [
          { status: direction },
          { student: { fullName: "asc" } },
          { studentId: "asc" },
        ];
      case "updatedAt":
        return [{ updatedAt: direction }, { id: "asc" }];
      case "gradeOrder":
      default:
        return [
          { sourceGradeLevel: { order: direction } },
          { student: { fullName: "asc" } },
          { studentId: "asc" },
        ];
    }
  }

  private chunk<T>(values: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }
    return chunks;
  }

  private async recordAudit(
    audit: AuditEventInput | undefined,
    tx: Prisma.TransactionClient,
    context: Record<string, unknown> = {},
  ): Promise<void> {
    if (!audit || !this.auditRecorder) {
      return;
    }
    await this.auditRecorder.record(
      {
        ...audit,
        context: { ...audit.context, ...context },
      },
      tx,
    );
  }

  private toCommitAttempt(row: {
    id: string;
    lifecycleRunId: string;
    previewRunId: string;
    campusId: string;
    status: string;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    alreadyAppliedCount: number;
    createdByUserId: string;
    startedAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    rowResults: Array<{
      id: string;
      lifecycleCandidateId: string;
      studentId: string;
      status: string;
      outcome: string;
      targetClassId: string | null;
      conflictCode: string | null;
      message: string | null;
      resultingSchoolYearEnrollmentId: string | null;
      resultingClassEnrollmentId: string | null;
      operations: Prisma.JsonValue;
      context: Prisma.JsonValue;
      createdAt: Date;
    }>;
  }): SchoolYearLifecycleCommitAttemptResult {
    return {
      id: row.id,
      lifecycleRunId: row.lifecycleRunId,
      previewRunId: row.previewRunId,
      campusId: row.campusId,
      status: row.status as SchoolYearLifecycleCommitAttemptStatus,
      successCount: row.successCount,
      failedCount: row.failedCount,
      skippedCount: row.skippedCount,
      alreadyAppliedCount: row.alreadyAppliedCount,
      createdByUserId: row.createdByUserId,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      rows: row.rowResults.map((result) => ({
        id: result.id,
        candidateId: result.lifecycleCandidateId,
        studentId: result.studentId,
        status: result.status as SchoolYearLifecycleCommitStatus,
        outcome: result.outcome as SchoolYearLifecycleOutcome,
        targetClassId: result.targetClassId,
        conflictCode: result.conflictCode,
        message: result.message,
        resultingSchoolYearEnrollmentId: result.resultingSchoolYearEnrollmentId,
        resultingClassEnrollmentId: result.resultingClassEnrollmentId,
        operations:
          result.operations as unknown as SchoolYearLifecycleCommitAttemptResult["rows"][number]["operations"],
        context:
          result.context as unknown as SchoolYearLifecycleCommitAttemptResult["rows"][number]["context"],
        createdAt: result.createdAt,
      })),
    };
  }

  private toRun(row: {
    id: string;
    campusId: string;
    sourceSchoolYearId: string;
    targetSchoolYearId: string;
    sourceClosureDate: Date;
    targetEnrollmentDate: Date;
    status: string;
    version: number;
    createdByUserId: string;
    updatedByUserId: string | null;
    firstCommittedAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    expiredAt: Date | null;
    retentionExpiresAt: Date | null;
    retentionPolicySource: string | null;
    legalHold: boolean;
    lastActivityAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }): SchoolYearLifecycleRun {
    return {
      ...row,
      status: row.status as SchoolYearLifecycleRunStatus,
    };
  }

  private toCandidate(row: {
    id: string;
    lifecycleRunId: string;
    campusId: string;
    studentId: string;
    sourceSchoolYearEnrollmentId: string;
    sourceEnrollmentId: string | null;
    sourceGradeLevelId: string;
    sourceClassId: string | null;
    status: string;
    recommendedOutcome: string;
    decision: string | null;
    targetGradeLevelId: string | null;
    targetClassId: string | null;
    decisionNote: string | null;
    conflictCode: string | null;
    message: string | null;
    decisionUpdatedByUserId: string | null;
    decisionUpdatedAt: Date | null;
    rowVersion: number;
    committedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SchoolYearLifecycleCandidate {
    return {
      ...row,
      status: row.status as SchoolYearLifecycleCandidateStatus,
      recommendedOutcome: row.recommendedOutcome as SchoolYearLifecycleOutcome,
      decision: row.decision as SchoolYearLifecycleOutcome | null,
      conflictCode:
        row.conflictCode as SchoolYearLifecycleCandidate["conflictCode"],
    };
  }

  private toPreviewRun(row: {
    id: string;
    lifecycleRunId: string | null;
    runVersion: number | null;
    campusId: string;
    sourceSchoolYearId: string;
    targetSchoolYearId: string;
    sourceClosureDate: Date;
    targetEnrollmentDate: Date;
    digest: string;
    requestPayload: Prisma.JsonValue;
    resultPayload: Prisma.JsonValue;
    scopeType: string;
    scopeIdentity: string | null;
    scopePayload: Prisma.JsonValue | null;
    status: string;
    expiresAt: Date;
    invalidatedAt: Date | null;
    supersededAt: Date | null;
    finalizedAt: Date | null;
    createdByUserId: string;
    createdAt: Date;
    updatedAt: Date;
  }): SchoolYearLifecyclePreviewRun {
    return {
      ...row,
      scopeType: row.scopeType as SchoolYearLifecycleScopeType,
      status: row.status as SchoolYearLifecyclePreviewRunStatus,
    };
  }
}
