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

    // Step 6: Build the closed entity. Reuses domain invariants (AC-8):
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

    // Step 7: Build the opened entity in the target class.
    const opened = Enrollment.create({
      classId: input.toClassId,
      studentId: input.studentId,
      enrollmentDate: transferDate,
      note: input.note ?? null,
    });

    // Step 8: Persist atomically — close + open inside a single DB transaction.
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
