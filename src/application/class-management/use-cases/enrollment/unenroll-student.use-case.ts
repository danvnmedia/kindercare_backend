import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";

@Injectable()
export class UnenrollStudentUseCase {
  private readonly logger = new Logger(UnenrollStudentUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(enrollmentId: string, campusId?: string): Promise<void> {
    try {
      this.logger.log(`Unenrolling enrollment: ${enrollmentId}`);

      // Step 1: Find existing enrollment
      const enrollment = await this.enrollmentRepository.findById(enrollmentId);
      if (!enrollment) {
        throw new NotFoundException(
          `Enrollment with ID ${enrollmentId} not found`,
        );
      }

      // Step 2: Verify enrollment belongs to the specified campus (via class)
      if (campusId) {
        const classEntity = await this.classRepository.findById(
          enrollment.classId,
        );
        if (!classEntity || classEntity.campusId !== campusId) {
          throw new NotFoundException(
            `Enrollment with ID ${enrollmentId} not found in this campus`,
          );
        }
      }

      // Step 3: Delete enrollment
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
