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
import { User } from "@/domain/user-management/user.entity";
import { ClassRepository } from "../../ports/class.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { EnrollmentReadinessContext } from "../../enrollment-readiness.types";
import { buildEnrollmentResultContext } from "../../enrollment-result-context";
import { buildEnrollmentSnapshot } from "../../historical-snapshot";
import {
  isEnrollmentPeriodOverlapPersistenceError,
  previousUtcDate,
} from "../../enrollment-period";

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
  context?: EnrollmentReadinessContext;
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
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
  ) {}

  async execute(
    input: BulkTransferStudentsInput,
    currentUser: User,
  ): Promise<BulkTransferStudentsResult> {
    // currentUser is the acting admin, plumbed by `student-enrollment.controller`
    // for audit-log emission (@task-qyz3jv, @doc/specs/admin-audit-log FR-3).
    // Each persisted pair in this batch will emit one TRANSFER_STUDENT audit
    // event when @task-nrm0az wires the recorder.
    void currentUser;
    const sourceClosureDate = previousUtcDate(input.transferDate);
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
    const targetContext = buildEnrollmentResultContext(
      input.transferDate,
      targetClass,
    );

    // ---- Per-row validation (FR-11) and persistence (FR-12, D7). ----
    const transferred: BulkTransferredPair[] = [];
    const skipped: BulkTransferSkippedItem[] = [];

    for (const row of input.students) {
      const active = await this.enrollmentRepository.findEffectiveByStudentIdAt(
        row.studentId,
        sourceClosureDate,
      );
      if (!active) {
        skipped.push({
          studentId: row.studentId,
          reason: "NO_ACTIVE_ENROLLMENT",
          context: { ...targetContext, activeEnrollment: null },
        });
        continue;
      }
      const activeContext = buildEnrollmentResultContext(
        input.transferDate,
        targetClass,
        { activeEnrollment: active },
      );
      // Source mismatch only fires when caller supplied fromClassId.
      if (row.fromClassId && row.fromClassId !== active.classId) {
        skipped.push({
          studentId: row.studentId,
          reason: "TRANSFER_SOURCE_MISMATCH",
          context: activeContext,
        });
        continue;
      }
      if (active.classId === input.classId) {
        skipped.push({
          studentId: row.studentId,
          reason: "TRANSFER_SAME_CLASS",
          context: activeContext,
        });
        continue;
      }

      const overlap =
        await this.enrollmentRepository.findOverlappingByStudentId(
          row.studentId,
          input.transferDate,
          null,
          active.id,
        );
      if (overlap) {
        skipped.push({
          studentId: row.studentId,
          reason: EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP,
          context: buildEnrollmentResultContext(
            input.transferDate,
            targetClass,
            {
              activeEnrollment: active,
              conflictingEnrollment: overlap,
            },
          ),
        });
        continue;
      }

      // Parent-enrollment grade-match gate per row
      // (specs/school-year-enrollment-model D3, AC-19, Scenario 9 +
      // bulk-enrollment FR-11 per-row tolerant pattern).
      //
      // Resolved against the *target* class's school year. Missing parent
      // here is theoretically a data-integrity violation (active enrollment
      // without a parent breaks D6), but for bulk we degrade to a per-row
      // skip rather than aborting the whole batch — one broken-data row
      // should not block the survivors. Grade mismatch is the user-facing
      // path and follows the same tolerant skip pattern.
      const parent =
        await this.schoolYearEnrollmentRepository.findCoveringDateByStudentAndSchoolYear(
          row.studentId,
          targetClass.schoolYearId,
          input.transferDate,
        );
      if (!parent) {
        this.logger.warn(
          `Bulk transfer row skipped: student ${row.studentId} has active enrollment ${active.id} but no open SchoolYearEnrollment for schoolYearId=${targetClass.schoolYearId} (data integrity)`,
        );
        skipped.push({
          studentId: row.studentId,
          reason: SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
          context: {
            ...activeContext,
            schoolYearEnrollment: null,
          },
        });
        continue;
      }
      if (parent.gradeLevelId !== targetClass.gradeLevelId) {
        skipped.push({
          studentId: row.studentId,
          reason: SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
          context: buildEnrollmentResultContext(
            input.transferDate,
            targetClass,
            { activeEnrollment: active, schoolYearEnrollment: parent },
          ),
        });
        continue;
      }
      if (!active.student) {
        this.logger.warn(
          `Bulk transfer row skipped: active enrollment ${active.id} for student ${row.studentId} did not load student snapshot source`,
        );
        skipped.push({
          studentId: row.studentId,
          reason: "STUDENT_SNAPSHOT_SOURCE_MISSING",
          context: buildEnrollmentResultContext(
            input.transferDate,
            targetClass,
            { activeEnrollment: active, schoolYearEnrollment: parent },
          ),
        });
        continue;
      }

      // Per-row note overrides batch note when set; an undefined per-row
      // note inherits the batch-level note. `!== undefined` lets an explicit
      // empty string per-row still override the batch.
      const note = row.note !== undefined ? row.note : (input.note ?? null);

      // Build the closed enrollment. Reuses domain invariants:
      // endDate >= enrollmentDate AND endDate <= today.
      let closed: Enrollment;
      try {
        closed = active.scheduleClosure(
          sourceClosureDate,
          ExitReason.TRANSFERRED,
        );
      } catch (error) {
        if (error instanceof InvalidEndDateException) {
          skipped.push({
            studentId: row.studentId,
            reason: "INVALID_TRANSFER_DATE",
            message: error.message,
            context: activeContext,
          });
          continue;
        }
        throw error;
      }

      // Thread the resolved parent.id explicitly into the opened row.
      // Equivalent to `active.schoolYearEnrollmentId` by D2/D3, but gives
      // the gate above a single source of truth and a clean drop-in point
      // for v2 cross-year transfers.
      const opened = Enrollment.create({
        classId: input.classId,
        studentId: row.studentId,
        schoolYearEnrollmentId: parent.id,
        enrollmentDate: input.transferDate,
        note,
        ...buildEnrollmentSnapshot(active.student, targetClass),
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
        if (isEnrollmentPeriodOverlapPersistenceError(error)) {
          this.logger.warn(
            `Bulk transfer row overlap race: classId=${input.classId} studentId=${row.studentId}`,
          );
          skipped.push({
            studentId: row.studentId,
            reason: EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP,
            context: buildEnrollmentResultContext(
              input.transferDate,
              targetClass,
              {
                activeEnrollment: active,
                conflictingEnrollment: null,
                schoolYearEnrollment: parent,
              },
            ),
          });
          continue;
        }
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Bulk transfer row failed: classId=${input.classId} studentId=${row.studentId} — ${message}`,
        );
        skipped.push({
          studentId: row.studentId,
          reason: "TRANSFER_FAILED",
          message,
          context: buildEnrollmentResultContext(
            input.transferDate,
            targetClass,
            {
              activeEnrollment: active,
              schoolYearEnrollment: parent,
            },
          ),
        });
      }
    }

    this.logger.log(
      `Bulk transfer done: classId=${input.classId} transferred=${transferred.length} skipped=${skipped.length}`,
    );

    return { transferred, skipped };
  }
}
