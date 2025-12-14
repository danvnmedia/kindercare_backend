import { Injectable, Inject, Logger, NotFoundException } from "@nestjs/common";
import { ClassTeacherRepository } from "../../ports/class-teacher.repository";
import { TeacherRepository } from "@/application/user-management/ports/teacher.repository";
import { ClassTeacher } from "@/domain/class-management/entities/class-teacher.entity";

@Injectable()
export class GetTeacherClassesUseCase {
  private readonly logger = new Logger(GetTeacherClassesUseCase.name);

  constructor(
    @Inject("CLASS_TEACHER_REPOSITORY")
    private readonly classTeacherRepository: ClassTeacherRepository,
    @Inject("TEACHER_REPOSITORY")
    private readonly teacherRepository: TeacherRepository,
  ) {}

  async execute(teacherId: string): Promise<ClassTeacher[]> {
    try {
      this.logger.log(`Fetching classes for teacher: ${teacherId}`);

      // Validate teacher exists
      const teacher = await this.teacherRepository.findById(teacherId);
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${teacherId} not found`);
      }

      const assignments = await this.classTeacherRepository.findByTeacherId(teacherId);

      this.logger.log(`Found ${assignments.length} class assignments for teacher ${teacherId}`);

      return assignments;
    } catch (error) {
      this.logger.error(`Failed to fetch teacher classes: ${error.message}`, error.stack);
      throw error;
    }
  }
}
