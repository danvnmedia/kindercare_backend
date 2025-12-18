import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Teacher } from "@/domain/user-management/entities/teacher.entity";
import { TeacherRepository } from "../../ports/teacher.repository";
import { UserRepository } from "../../ports/user.repository";
import { IdentityService } from "@/infra/external-services/clerk/identity.service";

@Injectable()
export class ArchiveTeacherUseCase {
  private readonly logger = new Logger(ArchiveTeacherUseCase.name);

  constructor(
    @Inject("TEACHER_REPOSITORY")
    private readonly teacherRepository: TeacherRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(id: string): Promise<Teacher> {
    try {
      this.logger.log(`Archiving teacher: ${id}`);

      // Step 1: Find existing teacher
      const teacher = await this.teacherRepository.findById(id);
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${id} not found`);
      }

      // Step 2: Archive the teacher (soft delete)
      teacher.archive();
      const archivedTeacher = await this.teacherRepository.update(teacher);

      // Step 3: Deactivate linked user account if exists
      if (teacher.hasUserAccount()) {
        await this.deactivateUserAccount(teacher);
      }

      this.logger.log(`Teacher archived successfully: ${id}`);
      return archivedTeacher;
    } catch (error) {
      this.logger.error(
        `Failed to archive teacher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async deactivateUserAccount(teacher: Teacher): Promise<void> {
    try {
      const user = await this.userRepository.findById(teacher.userId!);
      if (user) {
        user.deactivate();
        await this.userRepository.update(user);
        this.logger.log(
          `User account deactivated for teacher: ${teacher.email}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to deactivate user account: ${error.message}`,
        error.stack,
      );
      // Don't throw - user deactivation failure shouldn't fail the archive operation
    }
  }
}
