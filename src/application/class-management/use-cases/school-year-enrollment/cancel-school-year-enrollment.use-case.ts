import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";

import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { EnrollmentCancellationReason } from "@/domain/class-management/enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { User } from "@/domain/user-management/user.entity";

import { EnrollmentCancellationRepository } from "../../ports/enrollment-cancellation.repository";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import {
  CancelSchoolYearEnrollmentInput,
  CancelSchoolYearEnrollmentResult,
  SchoolYearEnrollmentCancellationErrorCode,
} from "../../school-year-enrollment-cancellation";
import { resolveSchoolYearLifecycleRetention } from "../school-year-lifecycle/school-year-lifecycle-retention";

@Injectable()
export class CancelSchoolYearEnrollmentUseCase {
  constructor(
    private readonly cancellationRepository: EnrollmentCancellationRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
    @Optional()
    private readonly historicalRecordRepository?: HistoricalRecordRepository,
  ) {}

  async execute(
    input: CancelSchoolYearEnrollmentInput,
    currentUser: User,
  ): Promise<CancelSchoolYearEnrollmentResult> {
    const note = normalizeNote(input.note);
    assertCancellationReason(input.cancellationReason);

    const visibleParent = await this.cancellationRepository.findParentById(
      input.id,
    );
    this.assertVisibleParent(visibleParent, input.campusId);

    if (
      visibleParent!.getEffectiveStatus(new Date()) ===
      EnrollmentEffectiveStatus.CANCELLED
    ) {
      return this.buildReplay(visibleParent!);
    }

    try {
      return await this.transactionRunner.run(async (tx) => {
        const currentParent = await this.cancellationRepository.findParentById(
          input.id,
          tx,
        );
        this.assertVisibleParent(currentParent, input.campusId);

        if (
          currentParent!.getEffectiveStatus(new Date()) ===
          EnrollmentEffectiveStatus.CANCELLED
        ) {
          return this.buildReplay(currentParent!, tx);
        }

        const cancelledAt = new Date();
        const parentStatus = currentParent!.getEffectiveStatus(cancelledAt);
        this.throwWhenParentIsNotUpcoming(parentStatus);

        const actorFullName = currentUser.profile?.fullName ?? null;
        const cancelledParent = currentParent!.cancel({
          cancelledAt,
          reason: input.cancellationReason,
          note,
          actorId: currentUser.id,
          actorFullName,
        });
        const persistedParent =
          await this.cancellationRepository.cancelParentIfUpcoming(
            cancelledParent,
            cancelledAt,
            tx,
          );
        if (!persistedParent) {
          return this.classifyConditionalWriteMiss(input, tx);
        }

        const children =
          await this.cancellationRepository.findChildrenByParentId(
            input.id,
            tx,
          );
        const childStatuses = children.map((child) => ({
          child,
          status: child.getEffectiveStatus(cancelledAt),
        }));
        const activeChildren = childStatuses.filter(
          ({ status }) => status === EnrollmentEffectiveStatus.ACTIVE,
        );
        if (activeChildren.length > 0) {
          throw new ConflictException({
            code: SchoolYearEnrollmentCancellationErrorCode.CANCELLATION_CHILD_STATE_CONFLICT,
            currentStatus: parentStatus,
            childEnrollmentIds: activeChildren.map(({ child }) => child.id),
            action: "WITHDRAW",
          });
        }

        const childrenToCancel = childStatuses
          .filter(({ status }) => status === EnrollmentEffectiveStatus.UPCOMING)
          .map(({ child }) =>
            child.cancel({
              cancelledAt,
              reason: input.cancellationReason,
              note,
              actorId: currentUser.id,
              actorFullName,
            }),
          );
        const affectedChildren =
          await this.cancellationRepository.cancelChildrenIfUpcoming(
            childrenToCancel,
            cancelledAt,
            tx,
          );
        if (!affectedChildren) {
          return this.throwChildConditionalWriteMiss(input.id, tx);
        }
        const lifecycle = await this.cancellationRepository.reconcileLifecycle(
          {
            schoolYearEnrollmentId: persistedParent.id,
            campusId: input.campusId,
            cancelledAt,
            retention: await resolveSchoolYearLifecycleRetention(
              this.historicalRecordRepository,
              input.campusId,
              cancelledAt,
            ),
          },
          tx,
        );

        const affectedChildIds = affectedChildren!.map((child) => child.id);
        await this.recorder.record(
          {
            actorId: currentUser.id,
            action: "CANCEL_SCHOOL_YEAR_ENROLLMENT",
            targetType: "student",
            targetId: persistedParent.studentId,
            campusId: input.campusId,
            context: {
              actorName: actorFullName,
              studentId: persistedParent.studentId,
              schoolYearEnrollmentId: persistedParent.id,
              schoolYearId: persistedParent.schoolYearId,
              scheduledEnrollmentDate:
                persistedParent.enrollmentDate.toISOString(),
              cancellationReason: input.cancellationReason,
              cancellationNote: note,
              affectedChildIds,
              affectedChildCount: affectedChildIds.length,
              lifecycle,
              beforeStatus: EnrollmentEffectiveStatus.UPCOMING,
              afterStatus: EnrollmentEffectiveStatus.CANCELLED,
            },
            beforeValue: {
              effectiveStatus: EnrollmentEffectiveStatus.UPCOMING,
              cancelledAt: null,
            },
            afterValue: {
              effectiveStatus: EnrollmentEffectiveStatus.CANCELLED,
              cancelledAt: persistedParent.cancelledAt?.toISOString() ?? null,
            },
          },
          tx,
        );

        return this.toResult(persistedParent, affectedChildren, false);
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "LIFECYCLE_CANCELLATION_RECONCILIATION_CONFLICT"
      ) {
        throw new ConflictException({
          code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION,
        });
      }
      if (
        isCancellationCommitConstraint(
          error,
          "sye_cancel_requires_upcoming_at_commit",
          "ENROLLMENT_ALREADY_EFFECTIVE",
        )
      ) {
        throw new ConflictException({
          code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_ALREADY_EFFECTIVE,
          currentStatus: EnrollmentEffectiveStatus.ACTIVE,
          action: "WITHDRAW",
        });
      }
      if (
        isCancellationCommitConstraint(
          error,
          "enrollment_cancel_requires_upcoming_at_commit",
          "CANCELLATION_CHILD_STATE_CONFLICT",
        )
      ) {
        throw new ConflictException({
          code: SchoolYearEnrollmentCancellationErrorCode.CANCELLATION_CHILD_STATE_CONFLICT,
          action: "WITHDRAW",
        });
      }
      throw error;
    }
  }

  private async classifyConditionalWriteMiss(
    input: CancelSchoolYearEnrollmentInput,
    tx: AppTransactionClient,
  ): Promise<CancelSchoolYearEnrollmentResult> {
    const latest = await this.cancellationRepository.findParentById(
      input.id,
      tx,
    );
    this.assertVisibleParent(latest, input.campusId);
    const status = latest!.getEffectiveStatus(new Date());
    if (status === EnrollmentEffectiveStatus.CANCELLED) {
      return this.buildReplay(latest!, tx);
    }
    this.throwWhenParentIsNotUpcoming(status);
    throw new ConflictException({
      code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION,
      currentStatus: status,
    });
  }

  private async throwChildConditionalWriteMiss(
    schoolYearEnrollmentId: string,
    tx: AppTransactionClient,
  ): Promise<never> {
    const latestChildren =
      await this.cancellationRepository.findChildrenByParentId(
        schoolYearEnrollmentId,
        tx,
      );
    const activeChildIds = latestChildren
      .filter(
        (child) =>
          child.getEffectiveStatus(new Date()) ===
          EnrollmentEffectiveStatus.ACTIVE,
      )
      .map((child) => child.id);
    if (activeChildIds.length > 0) {
      throw new ConflictException({
        code: SchoolYearEnrollmentCancellationErrorCode.CANCELLATION_CHILD_STATE_CONFLICT,
        childEnrollmentIds: activeChildIds,
        action: "WITHDRAW",
      });
    }
    throw new ConflictException({
      code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION,
    });
  }

  private throwWhenParentIsNotUpcoming(
    status: EnrollmentEffectiveStatus,
  ): void {
    if (status === EnrollmentEffectiveStatus.ACTIVE) {
      throw new ConflictException({
        code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_ALREADY_EFFECTIVE,
        currentStatus: status,
        action: "WITHDRAW",
      });
    }
    if (status === EnrollmentEffectiveStatus.CLOSED) {
      throw new ConflictException({
        code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_ALREADY_CLOSED,
        currentStatus: status,
      });
    }
    if (status !== EnrollmentEffectiveStatus.UPCOMING) {
      throw new ConflictException({
        code: SchoolYearEnrollmentCancellationErrorCode.ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION,
        currentStatus: status,
      });
    }
  }

  private assertVisibleParent(
    parent: SchoolYearEnrollment | null,
    campusId: string,
  ): void {
    if (!parent || parent.campusId !== campusId) {
      throw new NotFoundException("School-year enrollment not found");
    }
  }

  private async buildReplay(
    parent: SchoolYearEnrollment,
    tx?: AppTransactionClient,
  ): Promise<CancelSchoolYearEnrollmentResult> {
    const children = await this.cancellationRepository.findChildrenByParentId(
      parent.id,
      tx,
    );
    const affectedChildren = children.filter((child) =>
      wasCancelledWithParent(child, parent),
    );
    return this.toResult(parent, affectedChildren, true);
  }

  private toResult(
    parent: SchoolYearEnrollment,
    affectedChildren: Enrollment[],
    idempotentReplay: boolean,
  ): CancelSchoolYearEnrollmentResult {
    const affectedChildIds = affectedChildren.map((child) => child.id);
    return {
      resultStatus: EnrollmentEffectiveStatus.CANCELLED,
      parent,
      affectedChildren,
      affectedChildIds,
      affectedChildCount: affectedChildIds.length,
      idempotentReplay,
    };
  }
}

function normalizeNote(note: string | null | undefined): string | null {
  const normalized = note?.trim() || null;
  if (normalized && normalized.length > 500) {
    throw new BadRequestException("CANCELLATION_NOTE_TOO_LONG");
  }
  return normalized;
}

function assertCancellationReason(reason: EnrollmentCancellationReason): void {
  if (!Object.values(EnrollmentCancellationReason).includes(reason)) {
    throw new BadRequestException("INVALID_CANCELLATION_REASON");
  }
}

function wasCancelledWithParent(
  child: Enrollment,
  parent: SchoolYearEnrollment,
): boolean {
  return (
    child.cancelledAt?.getTime() === parent.cancelledAt?.getTime() &&
    child.cancellationReason === parent.cancellationReason &&
    child.cancelledByUserId === parent.cancelledByUserId
  );
}

function isCancellationCommitConstraint(
  error: unknown,
  constraint: string,
  message: string,
): boolean {
  const candidate = error as {
    message?: string;
    meta?: unknown;
  };
  const serialized = `${candidate.message ?? ""} ${JSON.stringify(candidate.meta ?? {})}`;
  return serialized.includes(constraint) || serialized.includes(message);
}
