import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { User } from "@/domain/user-management/user.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { SchoolYearEnrollmentRepository } from "../../ports/school-year-enrollment.repository";
import { GradeLevelRepository } from "../../ports/grade-level.repository";
import {
  SchoolYearEnrollmentErrorCode,
  SchoolYearEnrollmentGradeCorrectionAction,
} from "../../school-year-enrollment-error-codes";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";

export interface CorrectSchoolYearEnrollmentGradeInput {
  id: string;
  studentId: string;
  campusId: string;
  gradeLevelId: string;
}

type GradeCorrectionBlockedReason =
  | "PARENT_CLOSED"
  | "CHILD_CLASS_ENROLLMENT_EXISTS";

@Injectable()
export class CorrectSchoolYearEnrollmentGradeUseCase {
  private readonly logger = new Logger(
    CorrectSchoolYearEnrollmentGradeUseCase.name,
  );

  constructor(
    @Inject("SCHOOL_YEAR_ENROLLMENT_REPOSITORY")
    private readonly schoolYearEnrollmentRepository: SchoolYearEnrollmentRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(
    input: CorrectSchoolYearEnrollmentGradeInput,
    currentUser: User,
  ): Promise<SchoolYearEnrollment> {
    this.logger.log(`Correcting grade for school-year enrollment ${input.id}`);

    const parent = await this.schoolYearEnrollmentRepository.findById(input.id);
    if (
      !parent ||
      parent.campusId !== input.campusId ||
      parent.studentId !== input.studentId
    ) {
      throw new NotFoundException(
        SchoolYearEnrollmentErrorCode.SCHOOL_YEAR_ENROLLMENT_NOT_FOUND,
      );
    }

    if (!parent.isActive()) {
      this.throwCorrectionNotAllowed("PARENT_CLOSED", 0);
    }

    const targetGrade = await this.gradeLevelRepository.findById(
      input.gradeLevelId,
    );
    if (!targetGrade || targetGrade.campusId !== input.campusId) {
      throw new NotFoundException(
        SchoolYearEnrollmentErrorCode.GRADE_LEVEL_NOT_FOUND,
      );
    }

    const childEnrollmentCount =
      await this.schoolYearEnrollmentRepository.countChildEnrollments(
        parent.id,
      );
    if (childEnrollmentCount > 0) {
      this.throwCorrectionNotAllowed(
        "CHILD_CLASS_ENROLLMENT_EXISTS",
        childEnrollmentCount,
      );
    }

    if (parent.gradeLevelId === input.gradeLevelId) {
      return parent;
    }

    const updated = await this.transactionRunner.run(async (tx) => {
      const persisted =
        await this.schoolYearEnrollmentRepository.correctGradeLevel(
          parent.id,
          input.gradeLevelId,
          tx,
        );

      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "CORRECT_SCHOOL_YEAR_ENROLLMENT_GRADE",
          targetType: "student",
          targetId: parent.studentId,
          campusId: input.campusId,
          beforeValue: {
            schoolYearEnrollmentId: parent.id,
            gradeLevelId: parent.gradeLevelId,
            gradeLevelName: parent.gradeLevel?.name ?? null,
          },
          afterValue: {
            schoolYearEnrollmentId: persisted.id,
            gradeLevelId: persisted.gradeLevelId,
            gradeLevelName: persisted.gradeLevel?.name ?? targetGrade.name,
          },
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            schoolYearEnrollmentId: parent.id,
            schoolYearId: parent.schoolYearId,
            schoolYearName: parent.schoolYear?.name ?? null,
          },
        },
        tx,
      );

      return persisted;
    });

    this.logger.log(
      `SchoolYearEnrollment ${updated.id} grade corrected to ${updated.gradeLevelId}`,
    );
    return updated;
  }

  private throwCorrectionNotAllowed(
    reason: GradeCorrectionBlockedReason,
    childEnrollmentCount: number,
  ): never {
    throw new ConflictException({
      code: SchoolYearEnrollmentErrorCode.GRADE_CORRECTION_NOT_ALLOWED,
      action:
        SchoolYearEnrollmentGradeCorrectionAction.USE_FUTURE_CORRECTION_WORKFLOW,
      reason,
      childEnrollmentCount,
      message:
        "Grade correction is only allowed before class enrollment exists.",
    });
  }
}
