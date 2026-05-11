import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { EnrollmentAlreadyClosedException } from "@/domain/class-management/exceptions/enrollment-already-closed.exception";
import { InvalidEndDateException } from "@/domain/class-management/exceptions/invalid-end-date.exception";
import { EnrollmentRepository } from "../../ports/enrollment.repository";

export interface WithdrawStudentInput {
  enrollmentId: string;
  campusId: string;
  reason: ExitReason;
  endDate?: Date;
  note?: string;
}

@Injectable()
export class WithdrawStudentUseCase {
  private readonly logger = new Logger(WithdrawStudentUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  async execute(input: WithdrawStudentInput): Promise<Enrollment> {
    this.logger.log(
      `Withdrawing enrollment ${input.enrollmentId} (reason=${input.reason})`,
    );

    const enrollment = await this.enrollmentRepository.findById(
      input.enrollmentId,
    );
    if (!enrollment) {
      throw new NotFoundException(
        `Enrollment with ID ${input.enrollmentId} not found`,
      );
    }

    // Cross-campus: hide existence per AC-13 (404 Not Found, not 403 Forbidden).
    if (!enrollment.class || enrollment.class.campusId !== input.campusId) {
      throw new NotFoundException(
        `Enrollment with ID ${input.enrollmentId} not found`,
      );
    }

    if (input.note !== undefined) {
      enrollment.update({ note: input.note });
    }

    let closed: Enrollment;
    try {
      closed = enrollment.withdraw(input.endDate ?? new Date(), input.reason);
    } catch (error) {
      if (error instanceof EnrollmentAlreadyClosedException) {
        throw new ConflictException("ENROLLMENT_ALREADY_CLOSED");
      }
      if (error instanceof InvalidEndDateException) {
        throw new BadRequestException(`INVALID_END_DATE: ${error.message}`);
      }
      throw error;
    }

    const persisted = await this.enrollmentRepository.update(closed);
    this.logger.log(
      `Enrollment ${persisted.id} closed (endDate=${persisted.endDate?.toISOString()}, exitReason=${persisted.exitReason})`,
    );
    return persisted;
  }
}
