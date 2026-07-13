import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { User } from "@/domain/user-management/user.entity";
import { SchoolYearEnrollmentAlreadyClosedException } from "@/domain/class-management/exceptions/school-year-enrollment-already-closed.exception";
import { InvalidExitDateException } from "@/domain/class-management/exceptions/invalid-exit-date.exception";
import { EnrollmentAlreadyClosedException } from "@/domain/class-management/exceptions/enrollment-already-closed.exception";
import { InvalidEndDateException } from "@/domain/class-management/exceptions/invalid-end-date.exception";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

export interface WithdrawFromSchoolInput {
  id: string;
  campusId: string;
  reason: ExitReason;
  exitDate?: Date;
  note?: string;
}

export interface WithdrawFromSchoolResult {
  closedParent: SchoolYearEnrollment;
  closedChild: Enrollment | null;
}

/**
 * Closes the parent SchoolYearEnrollment and any open class-level child
 * enrollment in a single atomic transaction. See
 * specs/school-year-enrollment-model D4 (atomic cascade) + AC-13/14/15/22.
 */
@Injectable()
export class WithdrawFromSchoolUseCase {
  private readonly logger = new Logger(WithdrawFromSchoolUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: WithdrawFromSchoolInput,
    currentUser: User,
  ): Promise<WithdrawFromSchoolResult> {
    this.logger.log(
      `Withdrawing school-year enrollment ${input.id} (reason=${input.reason})`,
    );

    // Resolve parent. Cross-campus surfaces as 404 to hide existence,
    // matching the existing convention (see withdraw-student.use-case).
    const parent = await this.schoolYearEnrollmentRepository.findById(input.id);
    if (!parent || parent.campusId !== input.campusId) {
      throw new NotFoundException(
        `School year enrollment with ID ${input.id} not found`,
      );
    }

    // Pipe the optional withdrawal note onto the parent before closing so it
    // is carried through into the immutable closed entity returned by
    // withdraw(). Mirrors withdraw-student.use-case pattern.
    if (input.note !== undefined) {
      parent.update({ note: input.note });
    }

    const exitDate = input.exitDate ?? new Date();

    // Build closed parent. Entity invariants enforce
    //  (a) already-closed → SchoolYearEnrollmentAlreadyClosedException
    //  (b) exitDate < enrollmentDate OR > today → InvalidExitDateException
    let closedParent: SchoolYearEnrollment;
    try {
      closedParent = parent.withdraw(exitDate, input.reason);
    } catch (error) {
      if (error instanceof SchoolYearEnrollmentAlreadyClosedException) {
        throw new ConflictException(
          SchoolYearEnrollmentErrorCode.PARENT_ALREADY_CLOSED,
        );
      }
      if (error instanceof InvalidExitDateException) {
        throw new BadRequestException(
          `${SchoolYearEnrollmentErrorCode.INVALID_EXIT_DATE}: ${error.message}`,
        );
      }
      throw error;
    }

    // Resolve only the class period effective on the inclusive withdrawal
    // date. A future scheduled placement must not be closed accidentally.
    const openChild =
      await this.enrollmentRepository.findEffectiveByStudentIdAt(
        parent.studentId,
        exitDate,
      );

    let closedChild: Enrollment | null = null;
    if (openChild) {
      try {
        closedChild = openChild.withdraw(exitDate, input.reason);
      } catch (error) {
        // The child could have a later enrollmentDate than the parent (e.g.
        // late class placement). Surface the same INVALID_EXIT_DATE code so
        // the API contract stays consistent.
        if (error instanceof EnrollmentAlreadyClosedException) {
          // Defensive: the effective-date query excludes closed rows, so this
          // is effectively unreachable unless a race interleaves.
          throw new ConflictException(
            SchoolYearEnrollmentErrorCode.PARENT_ALREADY_CLOSED,
          );
        }
        if (error instanceof InvalidEndDateException) {
          throw new BadRequestException(
            `${SchoolYearEnrollmentErrorCode.INVALID_EXIT_DATE}: ${error.message}`,
          );
        }
        throw error;
      }
    }

    // Persist + emit audit inside one tx (D4 atomicity —
    // @doc/specs/admin-audit-log). Recorder throw rolls back parent + child
    // close together with the audit row.
    const result = await this.transactionRunner.run(async (tx) => {
      const persisted =
        await this.schoolYearEnrollmentRepository.withdrawWithChildren(
          closedParent,
          closedChild,
          tx,
        );
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "WITHDRAW_FROM_SCHOOL_YEAR",
          targetType: "student",
          targetId: parent.studentId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            schoolYearId: parent.schoolYearId,
            schoolYearName: parent.schoolYear?.name ?? null,
            exitDate: exitDate.toISOString(),
            exitReason: input.reason,
            alsoClosedChildClassEnrollmentId: openChild?.id ?? null,
          },
        },
        tx,
      );
      return persisted;
    });
    this.logger.log(
      `SchoolYearEnrollment ${result.closedParent.id} closed (child=${result.closedChild?.id ?? "none"})`,
    );
    return result;
  }
}
