import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentRepository } from "../../ports/student.repository";

@Injectable()
export class GetStudentByIdUseCase {
  private readonly logger = new Logger(GetStudentByIdUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(id: string, campusId?: string): Promise<Student> {
    try {
      this.logger.log(`Fetching student by ID: ${id}`);

      const student = await this.studentRepository.findById(id);

      if (!student) {
        throw new NotFoundException(`Student with ID ${id} not found`);
      }

      if (campusId && student.campusId !== campusId) {
        throw new NotFoundException(
          `Student with ID ${id} not found in this campus`,
        );
      }

      this.logger.log(`Found student: ${student.fullName}`);
      return student;
    } catch (error) {
      this.logger.error(
        `Failed to fetch student: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
