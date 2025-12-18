import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { ClassTeacherRepository } from "../../ports/class-teacher.repository";
import { ClassRepository } from "../../ports/class.repository";
import { ClassTeacher } from "@/domain/class-management/entities/class-teacher.entity";

@Injectable()
export class GetClassTeachersUseCase {
  private readonly logger = new Logger(GetClassTeachersUseCase.name);

  constructor(
    @Inject("CLASS_TEACHER_REPOSITORY")
    private readonly classTeacherRepository: ClassTeacherRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(classId: string): Promise<ClassTeacher[]> {
    try {
      this.logger.log(`Fetching teachers for class: ${classId}`);

      // Validate class exists
      const classEntity = await this.classRepository.findById(classId);
      if (!classEntity) {
        throw new NotFoundException(`Class with ID ${classId} not found`);
      }

      const assignments =
        await this.classTeacherRepository.findByClassId(classId);

      this.logger.log(
        `Found ${assignments.length} teacher assignments for class ${classId}`,
      );

      return assignments;
    } catch (error) {
      this.logger.error(
        `Failed to fetch class teachers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
