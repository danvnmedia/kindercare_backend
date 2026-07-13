import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { InvalidEndDateException } from "@/domain/class-management/exceptions/invalid-end-date.exception";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { ClassRepository } from "../../ports/class.repository";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { EnrollmentErrorCode } from "../../enrollment-error-codes";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";
import { previousUtcDate } from "../../enrollment-period";
import {
  EnrollmentReadinessMode,
  EnrollmentReadinessRow,
  EnrollmentReadinessState,
  EnrollmentReadinessStudentInput,
  EnrollmentReadinessContext,
} from "../../enrollment-readiness.types";

const MAX_BATCH_SIZE = 100;

export interface GetEnrollmentReadinessInput {
  campusId: string;
  classId: string;
  mode: EnrollmentReadinessMode;
  effectiveDate: Date;
  students: EnrollmentReadinessStudentInput[];
}

@Injectable()
export class GetEnrollmentReadinessUseCase {
  private readonly logger = new Logger(GetEnrollmentReadinessUseCase.name);

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
    input: GetEnrollmentReadinessInput,
  ): Promise<EnrollmentReadinessRow[]> {
    this.logger.log(
      `Enrollment readiness: classId=${input.classId} campusId=${input.campusId} mode=${input.mode} count=${input.students.length}`,
    );

    if (input.students.length === 0) {
      throw new BadRequestException(EnrollmentErrorCode.BATCH_EMPTY);
    }
    if (input.students.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(EnrollmentErrorCode.BATCH_TOO_LARGE);
    }

    const targetClass = await this.classRepository.findById(input.classId);
    if (!targetClass || targetClass.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const baseContext = this.buildContext(input.effectiveDate, targetClass);
    if (!targetClass.schoolYear!.isWithinDateRange(input.effectiveDate)) {
      return input.students.map((row) =>
        this.blocked(
          row.studentId,
          "ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR",
          baseContext,
        ),
      );
    }

    const result: EnrollmentReadinessRow[] = [];
    for (const row of input.students) {
      result.push(await this.evaluateRow(row, input, targetClass, baseContext));
    }
    return result;
  }

  private async evaluateRow(
    row: EnrollmentReadinessStudentInput,
    input: GetEnrollmentReadinessInput,
    targetClass: Class,
    baseContext: EnrollmentReadinessContext,
  ): Promise<EnrollmentReadinessRow> {
    const student = await this.studentRepository.findById(row.studentId);
    if (!student) {
      return this.blocked(
        row.studentId,
        EnrollmentErrorCode.STUDENT_NOT_FOUND,
        baseContext,
      );
    }
    if (student.campusId !== input.campusId) {
      return this.blocked(
        row.studentId,
        EnrollmentErrorCode.STUDENT_NOT_IN_CAMPUS,
        baseContext,
      );
    }

    const sourceDate =
      input.mode === EnrollmentReadinessMode.TRANSFER
        ? previousUtcDate(input.effectiveDate)
        : input.effectiveDate;
    const active = await this.enrollmentRepository.findEffectiveByStudentIdAt(
      row.studentId,
      sourceDate,
    );
    const context: EnrollmentReadinessContext = {
      ...baseContext,
      activeEnrollment: active ? enrollmentContext(active) : null,
    };

    if (input.mode === EnrollmentReadinessMode.TRANSFER) {
      const transferFailure = this.evaluateTransferSource(
        row,
        input,
        active,
        context,
      );
      if (transferFailure) return transferFailure;
    }

    const overlap = await this.enrollmentRepository.findOverlappingByStudentId(
      row.studentId,
      input.effectiveDate,
      null,
      input.mode === EnrollmentReadinessMode.TRANSFER ? active?.id : undefined,
    );
    if (overlap) {
      return this.blocked(
        row.studentId,
        EnrollmentErrorCode.ENROLLMENT_PERIOD_OVERLAP,
        {
          ...context,
          conflictingEnrollment: enrollmentContext(overlap),
        },
      );
    }

    const parent =
      await this.schoolYearEnrollmentRepository.findCoveringDateByStudentAndSchoolYear(
        row.studentId,
        targetClass.schoolYearId,
        input.effectiveDate,
      );
    if (!parent) {
      const latest =
        await this.schoolYearEnrollmentRepository.findLatestByStudentAndSchoolYear(
          row.studentId,
          targetClass.schoolYearId,
        );
      return this.blocked(
        row.studentId,
        latest?.getEffectiveStatus(input.effectiveDate) ===
          EnrollmentEffectiveStatus.CLOSED
          ? SchoolYearEnrollmentErrorCode.PARENT_ALREADY_CLOSED
          : SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
        {
          ...context,
          schoolYearEnrollment: latest ? parentContext(latest) : null,
        },
      );
    }

    const parentAwareContext: EnrollmentReadinessContext = {
      ...context,
      schoolYearEnrollment: parentContext(parent),
    };
    if (parent.gradeLevelId !== targetClass.gradeLevelId) {
      return this.blocked(
        row.studentId,
        SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
        parentAwareContext,
      );
    }

    return {
      studentId: row.studentId,
      state: EnrollmentReadinessState.READY,
      context: parentAwareContext,
    };
  }

  private evaluateTransferSource(
    row: EnrollmentReadinessStudentInput,
    input: GetEnrollmentReadinessInput,
    active: Enrollment | null,
    context: EnrollmentReadinessContext,
  ): EnrollmentReadinessRow | null {
    if (!active) {
      return this.blocked(row.studentId, "NO_ACTIVE_ENROLLMENT", context);
    }
    if (active.class?.campusId && active.class.campusId !== input.campusId) {
      return this.blocked(
        row.studentId,
        EnrollmentErrorCode.STUDENT_NOT_IN_CAMPUS,
        context,
      );
    }
    if (row.fromClassId && row.fromClassId !== active.classId) {
      return this.blocked(row.studentId, "TRANSFER_SOURCE_MISMATCH", context);
    }
    if (active.classId === input.classId) {
      return this.blocked(row.studentId, "TRANSFER_SAME_CLASS", context);
    }

    try {
      active.scheduleClosure(
        previousUtcDate(input.effectiveDate),
        ExitReason.TRANSFERRED,
      );
    } catch (error) {
      if (error instanceof InvalidEndDateException) {
        return this.blocked(
          row.studentId,
          "INVALID_TRANSFER_DATE",
          context,
          error.message,
        );
      }
      throw error;
    }
    return null;
  }

  private buildContext(
    requestedDate: Date,
    targetClass: Class,
  ): EnrollmentReadinessContext {
    return {
      requestedDate,
      targetClass: { id: targetClass.id, name: targetClass.name },
      targetGradeLevel: targetClass.gradeLevel
        ? {
            id: targetClass.gradeLevel.id,
            name: targetClass.gradeLevel.name,
            order: targetClass.gradeLevel.order,
          }
        : { id: targetClass.gradeLevelId, name: "", order: undefined },
      targetSchoolYear: targetClass.schoolYear
        ? {
            id: targetClass.schoolYear.id,
            name: targetClass.schoolYear.name,
            startDate: targetClass.schoolYear.startDate,
            endDate: targetClass.schoolYear.endDate,
          }
        : null,
    };
  }

  private blocked(
    studentId: string,
    reason: string,
    context: EnrollmentReadinessContext,
    message?: string,
  ): EnrollmentReadinessRow {
    return {
      studentId,
      state: EnrollmentReadinessState.BLOCKED,
      reason,
      message,
      context,
    };
  }
}

function parentContext(parent: SchoolYearEnrollment) {
  return {
    id: parent.id,
    gradeLevelId: parent.gradeLevelId,
    gradeLevel: parent.gradeLevel
      ? {
          id: parent.gradeLevel.id,
          name: parent.gradeLevel.name,
          order: parent.gradeLevel.order,
        }
      : null,
    enrollmentDate: parent.enrollmentDate,
    exitDate: parent.exitDate,
    exitReason: parent.exitReason,
  };
}

function enrollmentContext(enrollment: Enrollment) {
  return {
    id: enrollment.id,
    classId: enrollment.classId,
    class: enrollment.class
      ? { id: enrollment.class.id, name: enrollment.class.name }
      : null,
    enrollmentDate: enrollment.enrollmentDate,
    endDate: enrollment.endDate,
    exitReason: enrollment.exitReason,
  };
}
