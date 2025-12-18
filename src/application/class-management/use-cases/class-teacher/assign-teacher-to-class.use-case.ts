import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ClassTeacher } from "@/domain/class-management/entities/class-teacher.entity";
import { ClassTeacherRepository } from "../../ports/class-teacher.repository";
import { ClassRepository } from "../../ports/class.repository";
import { SubjectRepository } from "../../ports/subject.repository";
import { TeacherRepository } from "@/application/user-management/ports/teacher.repository";

export interface AssignTeacherToClassInput {
  classId: string;
  teacherId: string;
  subjectId: string;
}

@Injectable()
export class AssignTeacherToClassUseCase {
  private readonly logger = new Logger(AssignTeacherToClassUseCase.name);

  constructor(
    @Inject("CLASS_TEACHER_REPOSITORY")
    private readonly classTeacherRepository: ClassTeacherRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
    @Inject("TEACHER_REPOSITORY")
    private readonly teacherRepository: TeacherRepository,
    @Inject("SUBJECT_REPOSITORY")
    private readonly subjectRepository: SubjectRepository,
  ) {}

  async execute(input: AssignTeacherToClassInput): Promise<ClassTeacher> {
    try {
      this.logger.log(
        `Assigning teacher ${input.teacherId} to class ${input.classId} for subject ${input.subjectId}`,
      );

      // Step 1: Validate class exists
      const classEntity = await this.classRepository.findById(input.classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${input.classId} not found`);
      }

      // Step 2: Validate teacher exists
      const teacher = await this.teacherRepository.findById(input.teacherId);
      if (!teacher) {
        throw new NotFoundException(
          `Teacher with ID ${input.teacherId} not found`,
        );
      }

      // Step 3: Validate subject exists
      const subject = await this.subjectRepository.findById(input.subjectId);
      if (!subject) {
        throw new NotFoundException(
          `Subject with ID ${input.subjectId} not found`,
        );
      }

      // Step 4: Check for duplicate assignment
      const existingAssignment =
        await this.classTeacherRepository.findByCompositeKey(
          input.classId,
          input.teacherId,
          input.subjectId,
        );
      if (existingAssignment) {
        throw new ConflictException(
          `Teacher is already assigned to this class for this subject`,
        );
      }

      // Step 5: Create and save assignment
      const classTeacher = ClassTeacher.create({
        classId: input.classId,
        teacherId: input.teacherId,
        subjectId: input.subjectId,
      });

      const savedAssignment =
        await this.classTeacherRepository.save(classTeacher);
      this.logger.log(`Teacher assignment created for class ${input.classId}`);

      return savedAssignment;
    } catch (error) {
      this.logger.error(
        `Failed to assign teacher: ${error.message}`,
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
