import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { EnrollmentRepository } from "../../ports/enrollment.repository";

@Injectable()
export class UnenrollStudentUseCase {
  private readonly logger = new Logger(UnenrollStudentUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  async execute(enrollmentId: string): Promise<void> {
    try {
      this.logger.log(`Unenrolling enrollment: ${enrollmentId}`);

      // Step 1: Find existing enrollment
      const enrollment = await this.enrollmentRepository.findById(enrollmentId);
      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} not found`,
        );
      }

      // Step 2: Delete enrollment
      await this.enrollmentRepository.delete(enrollmentId);

      this.logger.log(`Enrollment deleted successfully: ${enrollmentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to unenroll student: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
