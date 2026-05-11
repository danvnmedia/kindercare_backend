import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { InvalidEndDateException } from "@/domain/class-management/exceptions/invalid-end-date.exception";
import { ClassRepository } from "../../ports/class.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";

const MAX_BATCH_SIZE = 100;

export interface BulkTransferStudentItem {
  studentId: string;
  fromClassId?: string;
  note?: string;
}

export interface BulkTransferStudentsInput {
  campusId: string;
  /** Target class id (the class students are being transferred *into*). */
  classId: string;
  transferDate: Date;
  note?: string;
  students: BulkTransferStudentItem[];
}

export interface BulkTransferSkippedItem {
  studentId: string;
  reason: string;
  message?: string;
}

export interface BulkTransferredPair {
  closed: Enrollment;
  opened: Enrollment;
}

export interface BulkTransferStudentsResult {
  transferred: BulkTransferredPair[];
  skipped: BulkTransferSkippedItem[];
}

/**
 * Bulk-transfer a batch of students into a target class in a single call.
 *
 * Two-stage validation per @doc/specs/bulk-enrollment FR-10 / FR-11:
 *   - Whole-call: short-circuits with 4xx and zero row work on first failure.
 *   - Per-row: tolerant; first failure pushes to `skipped[]` and continues.
 *
 * Each survivor runs through {@link EnrollmentRepository.transferEnrollment}
 * in its own DB transaction (D7) — partial-batch success is allowed and
 * expected. A failure on row N rolls back only that row's transaction; rows
 * already committed earlier in the loop stay persisted, and the loop
 * continues with subsequent rows.
 */
@Injectable()
export class BulkTransferStudentsUseCase {
  private readonly logger = new Logger(BulkTransferStudentsUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(
    input: BulkTransferStudentsInput,
  ): Promise<BulkTransferStudentsResult> {
    this.logger.log(
      `Bulk transfer: classId=${input.classId} campusId=${input.campusId} count=${input.students.length}`,
    );

    // ---- Whole-call validation (FR-10) — short-circuits in this exact order. ----
    if (input.students.length === 0) {
      throw new BadRequestException(EnrollmentErrorCode.BATCH_EMPTY);
    }
    if (input.students.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(EnrollmentErrorCode.BATCH_TOO_LARGE);
    }
    const seen = new Set<string>();
    for (const row of input.students) {
      if (seen.has(row.studentId)) {
        throw new BadRequestException(
          EnrollmentErrorCode.DUPLICATE_STUDENT_IN_BATCH,
        );
      }
      seen.add(row.studentId);
    }

    // Target class existence + cross-campus 404 (D5: hide existence — same
    // body for missing and cross-campus so callers cannot probe existence).
    const targetClass = await this.classRepository.findById(input.classId);
    if (!targetClass || targetClass.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    // PrismaClassRepository.findById always eager-loads schoolYear; non-null
    // assertion reflects a real invariant established by the repo contract.
    if (!targetClass.schoolYear!.isWithinDateRange(input.transferDate)) {
      throw new BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");
    }

    // ---- Per-row validation (FR-11) and persistence (FR-12, D7). ----
    const transferred: BulkTransferredPair[] = [];
    const skipped: BulkTransferSkippedItem[] = [];

    for (const row of input.students) {
      const active = await this.enrollmentRepository.findActiveByStudentId(
        row.studentId,
      );
      if (!active) {
        skipped.push({
          studentId: row.studentId,
          reason: "NO_ACTIVE_ENROLLMENT",
        });
        continue;
      }
      // Source mismatch only fires when caller supplied fromClassId.
      if (row.fromClassId && row.fromClassId !== active.classId) {
        skipped.push({
          studentId: row.studentId,
          reason: "TRANSFER_SOURCE_MISMATCH",
        });
        continue;
      }
      if (active.classId === input.classId) {
        skipped.push({
          studentId: row.studentId,
          reason: "TRANSFER_SAME_CLASS",
        });
        continue;
      }

      // Per-row note overrides batch note when set; an undefined per-row
      // note inherits the batch-level note. `!== undefined` lets an explicit
      // empty string per-row still override the batch.
      const note =
        row.note !== undefined ? row.note : (input.note ?? null);

      // Build the closed enrollment. Reuses domain invariants:
      // endDate >= enrollmentDate AND endDate <= today.
      let closed: Enrollment;
      try {
        closed = active.withdraw(input.transferDate, ExitReason.TRANSFERRED);
      } catch (error) {
        if (error instanceof InvalidEndDateException) {
          skipped.push({
            studentId: row.studentId,
            reason: "INVALID_TRANSFER_DATE",
            message: error.message,
          });
          continue;
        }
        throw error;
      }

      const opened = Enrollment.create({
        classId: input.classId,
        studentId: row.studentId,
        enrollmentDate: input.transferDate,
        note,
      });

      // Per-row atomicity (D7): one DB transaction per (close + open) pair.
      // A failure here rolls back only this row; committed rows from earlier
      // in the loop stay persisted, and the loop continues.
      try {
        const persisted = await this.enrollmentRepository.transferEnrollment(
          closed,
          opened,
        );
        transferred.push(persisted);
      } catch (error) {
        skipped.push({
          studentId: row.studentId,
          reason: "TRANSFER_FAILED",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.log(
      `Bulk transfer done: classId=${input.classId} transferred=${transferred.length} skipped=${skipped.length}`,
    );

    return { transferred, skipped };
  }
}
