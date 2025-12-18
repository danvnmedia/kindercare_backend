import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { EnrollmentRepository } from "../../ports/enrollment.repository";
import { ClassRepository } from "../../ports/class.repository";
import { StudentRepository } from "@/application/user-management/ports/student.repository";

export interface EnrollStudentInput {
  classId: string;
  studentId: string;
  enrollmentDate: Date;
  note?: string;
}

@Injectable()
export class EnrollStudentUseCase {
  private readonly logger = new Logger(EnrollStudentUseCase.name);

  constructor(
    @Inject("ENROLLMENT_REPOSITORY")
    private readonly enrollmentRepository: EnrollmentRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}

  async execute(input: EnrollStudentInput): Promise<Enrollment> {
    try {
      this.logger.log(
        `Enrolling student ${input.studentId} in class ${input.classId}`,
      );

      // Step 1: Validate class exists
      const classEntity = await this.classRepository.findById(input.classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${input.classId} not found`);
      }

      // Step 2: Validate student exists
      const student = await this.studentRepository.findById(input.studentId);
      if (!student) {
        throw new NotFoundException(
          `Student with ID ${input.studentId} not found`,
        );
      }

      // Step 3: Check for duplicate enrollment
      const existingEnrollment =
        await this.enrollmentRepository.findByStudentClassDate(
          input.studentId,
          input.classId,
          input.enrollmentDate,
        );
      if (existingEnrollment) {
        throw new ConflictException(
          `Student is already enrolled in this class on this date`,
        );
      }

      // Step 4: Create and save enrollment
      const enrollment = Enrollment.create({
        classId: input.classId,
        studentId: input.studentId,
        enrollmentDate: input.enrollmentDate,
        note: input.note || null,
      });

      const savedEnrollment = await this.enrollmentRepository.save(enrollment);
      this.logger.log(`Enrollment created: ${savedEnrollment.id}`);

      return savedEnrollment;
    } catch (error) {
      this.logger.error(
        `Failed to enroll student: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
