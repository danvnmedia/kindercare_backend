import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentRepository } from "../../ports/student.repository";

/**
 * Restore Student Use Case
 *
 * Restores a soft-deleted (archived) student by:
 * 1. Setting isArchived = false
 * 2. Setting status = ACTIVE
 *
 * Note: Students don't have user accounts, so no Clerk/user activation is needed.
 */
@Injectable()
export class RestoreStudentUseCase {
  private readonly logger = new Logger(RestoreStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(id: string, campusId?: string): Promise<Student> {
    this.logger.log(`Restoring student: ${id}`);

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

    // Step 3: Verify student is archived
    if (!student.isArchived) {
      throw new BadRequestException(`Student with ID ${id} is not archived`);
    }

    // Step 4: Restore student (sets isArchived=false and status=ACTIVE)
    student.restore();

    // Step 5: Persist changes
    await this.studentRepository.update(student);

    this.logger.log(`Student restored successfully: ${id}`);
    return student;
  }
}
