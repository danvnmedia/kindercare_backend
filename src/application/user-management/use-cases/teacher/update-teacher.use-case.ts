import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { Teacher, UpdateTeacherData } from '@/domain/user-management/entities/teacher.entity';
import { TeacherRepository } from '../../ports/teacher.repository';
import { UserRepository } from '../../ports/user.repository';
import { RoleRepository } from '../../ports/role.repository';
import { TeacherType } from '@/domain/user-management/enums/teacher-type.enum';

export interface UpdateTeacherInput extends UpdateTeacherData {
  teacherType?: TeacherType;
}

@Injectable()
export class UpdateTeacherUseCase {
  private readonly logger = new Logger(UpdateTeacherUseCase.name);

  constructor(
    @Inject('TEACHER_REPOSITORY')
    private readonly teacherRepository: TeacherRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, input: UpdateTeacherInput): Promise<Teacher> {
    try {
      this.logger.log(`Updating teacher: ${id}`);

      // Step 1: Find existing teacher
      const teacher = await this.teacherRepository.findById(id);
      if (!teacher) {
        throw new NotFoundException(`Teacher with ID ${id} not found`);
      }

      const oldTeacherType = teacher.teacherType;

      // Step 2: Update teacher profile
      teacher.updateProfile(input);

      // Step 3: If teacherType changed, update user role
      if (input.teacherType && input.teacherType !== oldTeacherType) {
        teacher.changeType(input.teacherType);
        await this.updateUserRole(teacher, oldTeacherType, input.teacherType);
      }

      // Step 4: Save updated teacher
      const updatedTeacher = await this.teacherRepository.update(teacher);

      this.logger.log(`Teacher updated successfully: ${id}`);
      return updatedTeacher;
    } catch (error) {
      this.logger.error(
        `Failed to update teacher: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private async updateUserRole(
    teacher: Teacher,
    oldType: TeacherType,
    newType: TeacherType,
  ): Promise<void> {
    if (!teacher.hasUserAccount()) {
      this.logger.log('Teacher has no user account, skipping role update');
      return;
    }

    try {
      const oldRoleId = Teacher.getTeacherRoleId(oldType);
      const newRoleId = Teacher.getTeacherRoleId(newType);

      // Verify new role exists
      const newRole = await this.roleRepository.findById(newRoleId);
      if (!newRole) {
        this.logger.warn(`New role ${newRoleId} not found, skipping role update`);
        return;
      }

      // Remove old role
      await this.userRepository.removeRoles(teacher.userId!, [oldRoleId]);
      this.logger.log(`Removed role ${oldRoleId} from user ${teacher.userId}`);

      // Assign new role
      await this.userRepository.assignRoles(teacher.userId!, [newRoleId]);
      this.logger.log(`Assigned role ${newRoleId} to user ${teacher.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update user role: ${error.message}`,
        error.stack,
      );
      // Don't throw - role update failure shouldn't fail the entire update
    }
  }
}
