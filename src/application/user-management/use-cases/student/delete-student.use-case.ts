import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { StudentRepository } from "../../ports/student.repository";
import { StudentNotFoundException } from "@/domain/user-management/exceptions/student-not-found.exception";

@Injectable()
export class DeleteStudentUseCase {
  private readonly logger = new Logger(DeleteStudentUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(id: string): Promise<void> {
    try {
      this.logger.log(`Deleting student: ${id}`);

      // 1. Find existing student
      const student = await this.studentRepository.findById(id);
      if (!student) {
        throw new StudentNotFoundException(id);
      }

      // 2. Delete student
      await this.studentRepository.delete(id);

      this.logger.log(`Student deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete student: ${error.message}`, error.stack);
      if (error instanceof StudentNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
