import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentRepository } from "../../ports/student.repository";

/**
 * Archive Student Use Case (Soft Delete)
 *
 * Performs soft delete by:
 * 1. Setting isArchived = true
 * 2. Setting status = DROPPED
 *
 * This preserves data for potential recovery.
 * Note: Students don't have user accounts, so no Clerk/user deactivation is needed.
 */
@Injectable()
export class ArchiveStudentUseCase {
  private readonly logger = new Logger(ArchiveStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(id: string, campusId?: string): Promise<Student> {
    this.logger.log(`Archiving student: ${id}`);

    // Step 1: Find existing student
    const student = await this.studentRepository.findById(id);
    if (!student) {
      throw new NotFoundException(`Student with ID ${id} not found`);
    }

    // Step 2: Verify student belongs to the specified campus (if campusId provided)
    if (campusId && student.campusId !== campusId) {
      throw new NotFoundException(
        `Student with ID ${id} not found in this campus`,
      );
    }

    // Step 3: Archive student (sets isArchived=true and status=DROPPED)
    student.archive();

    // Step 4: Persist changes
    await this.studentRepository.update(student);

    this.logger.log(`Student archived successfully: ${id}`);
    return student;
  }
}
