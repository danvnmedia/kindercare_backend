import { Injectable, Inject, Logger } from "@nestjs/common";
import { StudentRepository } from "../../ports/student.repository";
import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentNotFoundException } from "@/domain/user-management/exceptions/student-not-found.exception";

@Injectable()
export class GetStudentByIdUseCase {
  private readonly logger = new Logger(GetStudentByIdUseCase.name);

  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(studentId: string): Promise<Student> {
    this.logger.log(`Getting student by ID: ${studentId}`);

    const student = await this.studentRepository.findById(studentId);
    if (!student) {
      throw new StudentNotFoundException(studentId);
    }

    this.logger.log(`Found student: ${student.fullName}`);

    return student;
  }
}
