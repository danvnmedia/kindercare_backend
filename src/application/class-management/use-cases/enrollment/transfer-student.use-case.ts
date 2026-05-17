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
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";

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
  ) {}

  async execute(input: TransferStudentInput): Promise<TransferStudentResult> {
    const transferDate = input.transferDate ?? new Date();
    this.logger.log(
      `Transferring student ${input.studentId} to class ${input.toClassId} on ${transferDate.toISOString()}`,
    );

    // Step 1: Resolve target class. Cross-campus and missing both surface as 404
    // to hide existence, matching the withdraw convention (spec AC-13).
    const targetClass = await this.classRepository.findById(input.toClassId);
    if (!targetClass || targetClass.campusId !== input.campusId) {
      throw new NotFoundException(
        `Class with ID ${input.toClassId} not found`,
      );
    }

    // Step 2: Resolve student's active enrollment.
    const active = await this.enrollmentRepository.findActiveByStudentId(
      input.studentId,
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
      await this.schoolYearEnrollmentRepository.findOpenByStudentAndSchoolYear(
        input.studentId,
        targetClass.schoolYearId,
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

    // Step 7: Build the closed entity. Reuses domain invariants (AC-8):
    // endDate >= enrollmentDate AND endDate <= today.
    let closed: Enrollment;
    try {
      closed = active.withdraw(transferDate, ExitReason.TRANSFERRED);
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
    });

    // Step 9: Persist atomically — close + open inside a single DB transaction.
    // Either both succeed or both roll back (spec AC-20).
    const persisted = await this.enrollmentRepository.transferEnrollment(
      closed,
      opened,
    );
    this.logger.log(
      `Transfer complete: closed=${persisted.closed.id} opened=${persisted.opened.id}`,
    );
    return persisted;
  }
}
