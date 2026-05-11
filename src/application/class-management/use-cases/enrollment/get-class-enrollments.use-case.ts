import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";

export interface GetClassEnrollmentsInput {
  classId: string;
  campusId: string;
  includeHistorical?: boolean;
}

@Injectable()
export class GetClassEnrollmentsUseCase {
  private readonly logger = new Logger(GetClassEnrollmentsUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(input: GetClassEnrollmentsInput): Promise<Enrollment[]> {
    const includeHistorical = input.includeHistorical ?? false;
    this.logger.log(
      `Fetching enrollments for class ${input.classId} (includeHistorical=${includeHistorical})`,
    );

    // Resolve target class. Cross-campus + missing both surface as 404 to
    // hide existence (matches AC-13 pattern across this module).
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(
        `Class with ID ${input.classId} not found`,
      );
    }

    const enrollments = includeHistorical
      ? await this.enrollmentRepository.findHistoricalByClassId(input.classId)
      : await this.enrollmentRepository.findActiveByClassId(input.classId);

    this.logger.log(
      `Found ${enrollments.length} enrollments for class ${input.classId}`,
    );
    return enrollments;
  }
}
