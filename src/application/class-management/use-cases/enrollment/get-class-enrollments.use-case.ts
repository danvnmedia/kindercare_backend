import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import {
  buildHistoricalEnrollmentView,
  HistoricalEnrollmentView,
} from "../../historical-record-view";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { EnrollmentEffectiveStatusFilter } from "../../enrollment-effective-status-filter";

export interface GetClassEnrollmentsInput {
  classId: string;
  campusId: string;
  effectiveStatus?: EnrollmentEffectiveStatusFilter;
}

@Injectable()
export class GetClassEnrollmentsUseCase {
  private readonly logger = new Logger(GetClassEnrollmentsUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    private readonly historicalRecordRepository: HistoricalRecordRepository,
  ) {}

  async execute(
    input: GetClassEnrollmentsInput,
  ): Promise<HistoricalEnrollmentView[]> {
    const effectiveStatus =
      input.effectiveStatus ?? EnrollmentEffectiveStatusFilter.ACTIVE;
    const referenceDate = new Date();
    this.logger.log(
      `Fetching enrollments for class ${input.classId} (effectiveStatus=${effectiveStatus})`,
    );

    // Resolve target class. Cross-campus + missing both surface as 404 to
    // hide existence (matches AC-13 pattern across this module).
    const classEntity = await this.classRepository.findById(input.classId);
    if (!classEntity || classEntity.campusId !== input.campusId) {
      throw new NotFoundException(`Class with ID ${input.classId} not found`);
    }

    const enrollments =
      await this.enrollmentRepository.findByClassIdAndEffectiveStatus(
        input.classId,
        effectiveStatus,
        referenceDate,
      );

    this.logger.log(
      `Found ${enrollments.length} enrollments for class ${input.classId}`,
    );
    return Promise.all(
      enrollments.map(async (enrollment) =>
        buildHistoricalEnrollmentView(
          enrollment,
          await this.historicalRecordRepository.findCorrections(
            "ENROLLMENT",
            enrollment.id,
          ),
          referenceDate,
        ),
      ),
    );
  }
}
