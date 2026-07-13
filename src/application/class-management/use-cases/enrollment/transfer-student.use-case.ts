import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { InvalidEndDateException } from "@/domain/class-management/exceptions/invalid-end-date.exception";
import { User } from "@/domain/user-management/user.entity";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { buildEnrollmentSnapshot } from "../../historical-snapshot";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";
import {
  buildEnrollmentPeriodOverlapDetails,
  isEnrollmentPeriodOverlapPersistenceError,
  previousUtcDate,
} from "../../enrollment-period";

export interface TransferStudentInput {
  studentId: string;
  toClassId: string;
  campusId: string;
  transferDate?: Date;
  fromClassId?: string;
  note?: string;
}

export interface TransferStudentResult {
  closed: Enrollment;
  opened: Enrollment;
}

@Injectable()
export class TransferStudentUseCase {
  private readonly logger = new Logger(TransferStudentUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: TransferStudentInput,
    currentUser: User,
  ): Promise<TransferStudentResult> {
    const transferDate = input.transferDate ?? new Date();
    const sourceClosureDate = previousUtcDate(transferDate);
    this.logger.log(
      `Transferring student ${input.studentId} to class ${input.toClassId} on ${transferDate.toISOString()}`,
    );

    // Step 1: Resolve target class. Cross-campus and missing both surface as 404
    // to hide existence, matching the withdraw convention (spec AC-13).
    const targetClass = await this.classRepository.findById(input.toClassId);
    if (!targetClass || targetClass.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.toClassId} not found`);
    }

    // Step 2: Resolve the source effective through the day before the target
    // starts. Inclusive source end + next-day target start do not overlap.
    const active = await this.enrollmentRepository.findEffectiveByStudentIdAt(
      input.studentId,
      sourceClosureDate,
    );
    if (!active) {
      throw new ConflictException("NO_ACTIVE_ENROLLMENT");
    }

    // Step 3: Source-mismatch check (only when caller passed fromClassId).
    if (input.fromClassId && input.fromClassId !== active.classId) {
      throw new ConflictException("TRANSFER_SOURCE_MISMATCH");
    }

    // Step 4: Reject same-class transfers.
    if (active.classId === input.toClassId) {
      throw new ConflictException("TRANSFER_SAME_CLASS");
    }

    // Step 5: Validate transferDate against the *target* class's school year.
    // PrismaClassRepository.findById always eager-loads schoolYear, so the
    // non-null assertion reflects a real invariant.
    if (!targetClass.schoolYear!.isWithinDateRange(transferDate)) {
      throw new BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");
    }

    // Step 6: Parent-enrollment grade-match gate
    // (specs/school-year-enrollment-model D3, AC-19, Scenario 9).
    //
    // Resolve against the *target* class's school year. Class transfers never
    // change the parent (D2/D3), so the parent under the source and the target
    // are the same row when they share a school year — but resolving via the
    // target makes the data flow explicit and lets future cross-year transfers
    // (v2) drop in without restructuring.
    //
    // A missing parent here is NOT a user-facing 4xx: the student has an open
    // class enrollment (Step 2 verified `active`), so the partial unique index
    // `idx_sye_one_open_per_year` (D6) guarantees an open parent must exist.
    // Missing parent = data integrity violation → log + throw.
    const parent =
      await this.schoolYearEnrollmentRepository.findCoveringDateByStudentAndSchoolYear(
        input.studentId,
        targetClass.schoolYearId,
        transferDate,
      );
    if (!parent) {
      this.logger.error(
        `Data integrity violation: student ${input.studentId} has active enrollment ${active.id} but no open SchoolYearEnrollment for schoolYearId=${targetClass.schoolYearId}`,
      );
      throw new Error(
        "SchoolYearEnrollment missing for active enrollment — data integrity broken",
      );
    }
    if (parent.gradeLevelId !== targetClass.gradeLevelId) {
      throw new ConflictException(
        SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
      );
    }
    if (!active.student) {
      this.logger.error(
        `Data integrity violation: active enrollment ${active.id} did not load student snapshot source`,
      );
      throw new Error(
        "Student snapshot source missing for active enrollment — data integrity broken",
      );
    }

    const overlap = await this.enrollmentRepository.findOverlappingByStudentId(
      input.studentId,
      transferDate,
      null,
      active.id,
    );
    if (overlap) {
      throw new ConflictException({
        ...buildEnrollmentPeriodOverlapDetails(overlap),
        message: EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP,
      });
    }

    // Step 7: Schedule the inclusive source closure. Future transfer dates are
    // valid because source close + target open persist atomically.
    let closed: Enrollment;
    try {
      closed = active.scheduleClosure(
        sourceClosureDate,
        ExitReason.TRANSFERRED,
      );
    } catch (error) {
      if (error instanceof InvalidEndDateException) {
        throw new BadRequestException(
          `INVALID_TRANSFER_DATE: ${error.message}`,
        );
      }
      throw error;
    }

    // Step 8: Build the opened entity in the target class. Thread the resolved
    // parent.id explicitly — equivalent to `active.schoolYearEnrollmentId` by
    // D2/D3 but with single-source-of-truth provenance and a clean drop-in
    // point for v2 cross-year transfers.
    const opened = Enrollment.create({
      classId: input.toClassId,
      studentId: input.studentId,
      schoolYearEnrollmentId: parent.id,
      enrollmentDate: transferDate,
      note: input.note ?? null,
      ...buildEnrollmentSnapshot(active.student, targetClass),
    });

    // Step 9: Persist + emit audit atomically. close + open + audit row land
    // inside one DB transaction. Either all succeed or all roll back
    // (spec AC-20 + @doc/specs/admin-audit-log D4 + Scenario 1).
    let persisted: TransferStudentResult;
    try {
      persisted = await this.transactionRunner.run(async (tx) => {
        const result = await this.enrollmentRepository.transferEnrollment(
          closed,
          opened,
          tx,
        );
        await this.recorder.record(
          {
            actorId: currentUser.id,
            action: "TRANSFER_STUDENT",
            targetType: "student",
            targetId: input.studentId,
            campusId: input.campusId,
            context: {
              actorName: currentUser.profile?.fullName ?? null,
              fromClassId: active.classId,
              fromClassName: active.class?.name ?? null,
              toClassId: input.toClassId,
              toClassName: targetClass.name,
              sourceClosureDate: sourceClosureDate.toISOString(),
              transferDate: transferDate.toISOString(),
            },
          },
          tx,
        );
        return result;
      });
    } catch (error) {
      if (isEnrollmentPeriodOverlapPersistenceError(error)) {
        throw new ConflictException({
          ...buildEnrollmentPeriodOverlapDetails(null),
          message: EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP,
        });
      }
      throw error;
    }
    this.logger.log(
      `Transfer complete: closed=${persisted.closed.id} opened=${persisted.opened.id}`,
    );
    return persisted;
  }
}
