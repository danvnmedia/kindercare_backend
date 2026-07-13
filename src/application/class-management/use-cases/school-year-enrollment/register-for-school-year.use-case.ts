import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { User } from "@/domain/user-management/user.entity";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { SchoolYearRepository } from "../../ports/school-year.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { buildSchoolYearEnrollmentSnapshot } from "../../historical-snapshot";

export interface RegisterForSchoolYearInput {
  campusId: string;
  studentId: string;
  schoolYearId: string;
  gradeLevelId: string;
  enrollmentDate: Date;
  note?: string;
}

/**
 * Creates the parent SchoolYearEnrollment row. See
 * specs/school-year-enrollment-model D1 (explicit two-step registration),
 * D2 (period-only lifecycle), D3 (parent owns gradeLevelId), and D6 (one open
 * parent per (studentId, schoolYearId)).
 */
@Injectable()
export class RegisterForSchoolYearUseCase {
  private readonly logger = new Logger(RegisterForSchoolYearUseCase.name);

  constructor(
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("SCHOOL_YEAR_REPOSITORY")
    private readonly schoolYearRepository: SchoolYearRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: RegisterForSchoolYearInput,
    currentUser: User,
  ): Promise<SchoolYearEnrollment> {
    this.logger.log(
      `Registering student ${input.studentId} for school year ${input.schoolYearId}`,
    );

    // Validate student in caller's campus. Cross-campus hits surface as 404
    // to hide existence (existing convention; see enroll-student.use-case).
    const student = await this.studentRepository.findById(input.studentId);
    if (!student || student.campusId !== input.campusId) {
      throw new NotFoundException(
        `Student with ID ${input.studentId} not found`,
      );
    }

    // Validate school year exists in campus.
    const schoolYear = await this.schoolYearRepository.findById(
      input.schoolYearId,
    );
    if (!schoolYear || schoolYear.campusId !== input.campusId) {
      throw new NotFoundException(
        SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_NOT_FOUND,
      );
    }

    // Validate grade level exists in campus.
    const gradeLevel = await this.gradeLevelRepository.findById(
      input.gradeLevelId,
    );
    if (!gradeLevel || gradeLevel.campusId !== input.campusId) {
      throw new NotFoundException(
        SchoolYearEnrollmentErrorCode.GRADE_LEVEL_NOT_FOUND,
      );
    }

    // Validate enrollmentDate within school year bounds.
    if (!schoolYear.isWithinDateRange(input.enrollmentDate)) {
      throw new BadRequestException(
        SchoolYearEnrollmentErrorCode.REGISTRATION_DATE_OUT_OF_SCHOOL_YEAR,
      );
    }

    // Reject if an open parent already exists for (student, schoolYear).
    // The partial unique index `idx_sye_one_open_per_year` would otherwise
    // surface as an opaque DB error; the typed check returns first.
    const existingOpen =
      await this.schoolYearEnrollmentRepository.findStructurallyOpenByStudentAndSchoolYear(
        input.studentId,
        input.schoolYearId,
      );
    if (existingOpen) {
      throw new ConflictException(
        SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_ENROLLMENT_ALREADY_EXISTS,
      );
    }

    const entity = SchoolYearEnrollment.create({
      studentId: input.studentId,
      campusId: input.campusId,
      schoolYearId: input.schoolYearId,
      gradeLevelId: input.gradeLevelId,
      enrollmentDate: input.enrollmentDate,
      exitDate: null,
      exitReason: null,
      note: input.note ?? null,
      ...buildSchoolYearEnrollmentSnapshot(student, gradeLevel, schoolYear),
    });

    // Persist + emit audit inside one tx (D4 atomicity —
    // @doc/specs/admin-audit-log). Recorder throw rolls back the registration.
    const saved = await this.transactionRunner.run(async (tx) => {
      const persisted = await this.schoolYearEnrollmentRepository.save(
        entity,
        tx,
      );
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "REGISTER_FOR_SCHOOL_YEAR",
          targetType: "student",
          targetId: input.studentId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            schoolYearId: input.schoolYearId,
            schoolYearName: schoolYear.name,
            gradeLevelId: input.gradeLevelId,
            gradeLevelName: gradeLevel.name,
            enrollmentDate: input.enrollmentDate.toISOString(),
          },
        },
        tx,
      );
      return persisted;
    });
    this.logger.log(`SchoolYearEnrollment created: ${saved.id}`);
    return saved;
  }
}
