import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";

@Injectable()
export class GetClassEnrollmentsUseCase {
  private readonly logger = new Logger(GetClassEnrollmentsUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(classId: string, campusId?: string): Promise<Enrollment[]> {
    try {
      this.logger.log(`Fetching enrollments for class: ${classId}`);

      // Validate class exists
      const classEntity = await this.classRepository.findById(classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      // Verify class belongs to the specified campus (if campusId provided)
      if (campusId && classEntity.campusId !== campusId) {
        throw new NotFoundException(
          `Class with ID ${classId} not found in this campus`,
        );
      }

      const enrollments =
        await this.enrollmentRepository.findByClassId(classId);

      this.logger.log(
        `Found ${enrollments.length} enrollments for class ${classId}`,
      );

      return enrollments;
    } catch (error) {
      this.logger.error(
        `Failed to fetch class enrollments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
