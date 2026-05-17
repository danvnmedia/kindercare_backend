import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { ClassRepository } from "../../ports/class.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";

const MAX_BATCH_SIZE = 100;

export interface BulkEnrollStudentItem {
  studentId: string;
  note?: string;
}

export interface BulkEnrollStudentsInput {
  campusId: string;
  classId: string;
  enrollmentDate: Date;
  note?: string;
  students: BulkEnrollStudentItem[];
}

export interface BulkEnrollSkippedItem {
  studentId: string;
  reason: string;
  message?: string;
}

export interface BulkEnrollStudentsResult {
  enrolled: Enrollment[];
  skipped: BulkEnrollSkippedItem[];
}

/**
 * Bulk-enroll a batch of students into a class in a single call.
 *
 * Two-stage validation per @doc/specs/bulk-enrollment FR-3 / FR-4:
 *   - Whole-call: short-circuits with 4xx and zero row work on first failure.
 *   - Per-row: tolerant; first failure pushes to `skipped[]` and continues.
 *
 * Survivors persist via {@link EnrollmentRepository.saveMany} inside one
 * transaction (D3) — a DB-level error rolls back the entire batch.
 */
@Injectable()
export class BulkEnrollStudentsUseCase {
  private readonly logger = new Logger(BulkEnrollStudentsUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
  ) {}

  async execute(
    input: BulkEnrollStudentsInput,
  ): Promise<BulkEnrollStudentsResult> {
    this.logger.log(
      `Bulk enroll: classId=${input.classId} campusId=${input.campusId} count=${input.students.length}`,
    );

    // ---- Whole-call validation (FR-3) — short-circuits in this exact order. ----
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

    // Class existence + cross-campus 404 (D5: hide existence — same body for both).
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    // PrismaClassRepository.findById always eager-loads schoolYear; non-null
    // assertion reflects a real invariant established by the repo contract.
    if (!classEntity.schoolYear!.isWithinDateRange(input.enrollmentDate)) {
      throw new BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");
    }

    // ---- Per-row validation (FR-4) — first failure pushes to skipped[]. ----
    const skipped: BulkEnrollSkippedItem[] = [];
    const toEnroll: Enrollment[] = [];

    for (const row of input.students) {
      const student = await this.studentRepository.findById(row.studentId);
      if (!student) {
        skipped.push({
          studentId: row.studentId,
          reason: EnrollmentErrorCode.STUDENT_NOT_FOUND,
        });
        continue;
      }
      if (student.campusId !== input.campusId) {
        skipped.push({
          studentId: row.studentId,
          reason: EnrollmentErrorCode.STUDENT_NOT_IN_CAMPUS,
        });
        continue;
      }
      const active = await this.enrollmentRepository.findActiveByStudentId(
        row.studentId,
      );
      if (active) {
        // Inline per D4 — existing single-row code reused.
        skipped.push({
          studentId: row.studentId,
          reason: "STUDENT_ALREADY_ENROLLED",
        });
        continue;
      }
      const existing = await this.enrollmentRepository.findByStudentClassDate(
        row.studentId,
        input.classId,
        input.enrollmentDate,
      );
      if (existing) {
        skipped.push({
          studentId: row.studentId,
          reason: EnrollmentErrorCode.ENROLLMENT_ALREADY_EXISTS_ON_DATE,
        });
        continue;
      }

      // Parent-enrollment gate per row (specs/school-year-enrollment-model
      // D1/D3 + bulk-enrollment FR-4 per-row tolerant pattern). Missing parent
      // or grade mismatch is a per-row skip, NOT a whole-call abort.
      const parent =
        await this.schoolYearEnrollmentRepository.findOpenByStudentAndSchoolYear(
          row.studentId,
          classEntity.schoolYearId,
        );
      if (!parent) {
        skipped.push({
          studentId: row.studentId,
          reason: SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
        });
        continue;
      }
      if (parent.gradeLevelId !== classEntity.gradeLevelId) {
        skipped.push({
          studentId: row.studentId,
          reason: SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
        });
        continue;
      }

      // Per-row note overrides batch note when set; an undefined per-row
      // note inherits the batch-level note. `!== undefined` lets an explicit
      // empty string per-row still override the batch.
      const note =
        row.note !== undefined ? row.note : (input.note ?? null);

      toEnroll.push(
        Enrollment.create({
          classId: input.classId,
          studentId: row.studentId,
          schoolYearEnrollmentId: parent.id,
          enrollmentDate: input.enrollmentDate,
          note,
        }),
      );
    }

    // ---- Persist survivors atomically (FR-5, D3). ----
    const enrolled =
      toEnroll.length > 0
        ? await this.enrollmentRepository.saveMany(toEnroll)
        : [];

    this.logger.log(
      `Bulk enroll done: classId=${input.classId} enrolled=${enrolled.length} skipped=${skipped.length}`,
    );

    return { enrolled, skipped };
  }
}
