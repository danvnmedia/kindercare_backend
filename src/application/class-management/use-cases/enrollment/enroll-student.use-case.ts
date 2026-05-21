import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { User } from "@/domain/user-management/user.entity";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";
import { SchoolYearEnrollmentErrorCode } from "../../school-year-enrollment-error-codes";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

export interface EnrollStudentInput {
  campusId: string;
  classId: string;
  studentId: string;
  enrollmentDate: Date;
  note?: string;
}

@Injectable()
export class EnrollStudentUseCase {
  private readonly logger = new Logger(EnrollStudentUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: EnrollStudentInput,
    currentUser: User,
  ): Promise<Enrollment> {
    try {
      this.logger.log(
        `Enrolling student ${input.studentId} in class ${input.classId}`,
      );

      // Step 1: Validate class exists
      const classEntity = await this.classRepository.findById(input.classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${input.classId} not found`);
      }

      // Step 1b: Validate class belongs to the specified campus
      if (classEntity.campusId !== input.campusId) {
        throw new BadRequestException(`Class does not belong to this campus`);
      }

      // Step 2: Validate student exists
      const student = await this.studentRepository.findById(input.studentId);
      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found`,
        );
      }

      // Step 2b: Validate student belongs to the same campus as the class
      if (student.campusId !== input.campusId) {
        throw new BadRequestException(
          `Cannot enroll student from a different campus into this class`,
        );
      }

      // Step 3: Validate enrollmentDate within the class's school year.
      // PrismaClassRepository.findById always eager-loads schoolYear, so
      // the non-null assertion reflects a real invariant.
      if (!classEntity.schoolYear!.isWithinDateRange(input.enrollmentDate)) {
        throw new BadRequestException("ENROLLMENT_DATE_OUT_OF_SCHOOL_YEAR");
      }

      // Step 4: Reject if student has any currently-active enrollment.
      // Caller must transfer (atomic) or withdraw + enroll (two steps).
      const activeEnrollment =
        await this.enrollmentRepository.findActiveByStudentId(input.studentId);
      if (activeEnrollment) {
        throw new ConflictException("STUDENT_ALREADY_ENROLLED");
      }

      // Step 5: Defensive composite-key check (student, class, enrollmentDate).
      // The DB-level constraint would otherwise raise an opaque unique-violation.
      const existingEnrollment =
        await this.enrollmentRepository.findByStudentClassDate(
          input.studentId,
          input.classId,
          input.enrollmentDate,
        );
      if (existingEnrollment) {
        throw new ConflictException(
          `Student is already enrolled in this class on this date`,
        );
      }

      // Step 6: Parent-enrollment gate (specs/school-year-enrollment-model D1/D3).
      // Class enrollment requires an open parent SchoolYearEnrollment for the
      // student in the class's school year, and the parent's grade level must
      // match the class's grade level. Year-end grade changes go through the
      // (v2) promotion flow, not via direct class enrollment.
      const parent =
        await this.schoolYearEnrollmentRepository.findOpenByStudentAndSchoolYear(
          input.studentId,
          classEntity.schoolYearId,
        );
      if (!parent) {
        throw new ConflictException(
          SchoolYearEnrollmentErrorCode.NO_SCHOOL_YEAR_ENROLLMENT,
        );
      }
      if (parent.gradeLevelId !== classEntity.gradeLevelId) {
        throw new ConflictException(
          SchoolYearEnrollmentErrorCode.GRADE_LEVEL_MISMATCH,
        );
      }

      // Step 7: Create enrollment with parent FK threaded through.
      const enrollment = Enrollment.create({
        classId: input.classId,
        studentId: input.studentId,
        schoolYearEnrollmentId: parent.id,
        enrollmentDate: input.enrollmentDate,
        note: input.note || null,
      });

      // Step 8: Persist + emit audit inside one tx (D4 atomicity —
      // @doc/specs/admin-audit-log). Recorder throw rolls back the enrollment.
      const savedEnrollment = await this.transactionRunner.run(async (tx) => {
        const saved = await this.enrollmentRepository.save(enrollment, tx);
        await this.recorder.record(
          {
            actorId: currentUser.id,
            action: "ENROLL_STUDENT_TO_CLASS",
            targetType: "student",
            targetId: input.studentId,
            campusId: input.campusId,
            context: {
              actorName: currentUser.profile?.fullName ?? null,
              classId: input.classId,
              className: classEntity.name,
              enrollmentDate: input.enrollmentDate.toISOString(),
            },
          },
          tx,
        );
        return saved;
      });
      this.logger.log(`Enrollment created: ${savedEnrollment.id}`);

      return savedEnrollment;
    } catch (error) {
      this.logger.error(
        `Failed to enroll student: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
