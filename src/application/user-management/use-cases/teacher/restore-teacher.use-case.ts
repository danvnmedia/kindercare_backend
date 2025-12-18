import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Teacher } from "@/domain/user-management/entities/teacher.entity";
import { TeacherRepository } from "../../ports/teacher.repository";
import { UserRepository } from "../../ports/user.repository";

@Injectable()
export class RestoreTeacherUseCase {
  private readonly logger = new Logger(RestoreTeacherUseCase.name);

  constructor(
    @Inject("TEACHER_REPOSITORY")
    private readonly teacherRepository: TeacherRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
  ) {}

  async execute(id: string): Promise<Teacher> {
    try {
      this.logger.log(`Restoring teacher: ${id}`);

      // Step 1: Find existing teacher
      const teacher = await this.teacherRepository.findById(id);
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${id} not found`);
      }

      // Step 2: Restore the teacher
      teacher.restore();
      const restoredTeacher = await this.teacherRepository.update(teacher);

      // Step 3: Reactivate linked user account if exists
      if (teacher.hasUserAccount()) {
        await this.reactivateUserAccount(teacher);
      }

      this.logger.log(`Teacher restored successfully: ${id}`);
      return restoredTeacher;
    } catch (error) {
      this.logger.error(
        `Failed to restore teacher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async reactivateUserAccount(teacher: Teacher): Promise<void> {
    try {
      const user = await this.userRepository.findById(teacher.userId!);
      if (user) {
        user.activate();
        await this.userRepository.update(user);
        this.logger.log(
          `User account reactivated for teacher: ${teacher.email}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to reactivate user account: ${error.message}`,
        error.stack,
      );
      // Don't throw - user reactivation failure shouldn't fail the restore operation
    }
  }
}
