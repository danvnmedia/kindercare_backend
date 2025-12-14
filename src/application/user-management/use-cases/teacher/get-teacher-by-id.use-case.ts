import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { Teacher } from '@/domain/user-management/entities/teacher.entity';
import { TeacherRepository } from '../../ports/teacher.repository';

@Injectable()
export class GetTeacherByIdUseCase {
  private readonly logger = new Logger(GetTeacherByIdUseCase.name);

  constructor(
    @Inject('TEACHER_REPOSITORY')
    private readonly teacherRepository: TeacherRepository,
  ) {}

  async execute(id: string): Promise<Teacher> {
    try {
      this.logger.log(`Fetching teacher by ID: ${id}`);

      const teacher = await this.teacherRepository.findById(id);

      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${id} not found`);
      }

      this.logger.log(`Found teacher: ${teacher.fullName}`);
      return teacher;
    } catch (error) {
      this.logger.error(
        `Failed to fetch teacher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
