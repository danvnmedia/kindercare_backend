import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Teacher } from '@/domain/user-management/entities/teacher.entity';
import { Gender } from '@/domain/user-management/enums/gender.enum';
import { TeacherType } from '@/domain/user-management/enums/teacher-type.enum';
import { User } from '@/domain/user-management/user.entity';
import { TeacherRepository } from '../../ports/teacher.repository';
import { UserRepository } from '../../ports/user.repository';
import { RoleRepository } from '../../ports/role.repository';
import { IdentityService } from '@/infra/external-services/clerk/identity.service';

const DEFAULT_WEAK_PASSWORD = 'ChangeMe123!';

export interface CreateTeacherInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  teacherType: TeacherType;
  address?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  startDate?: Date;
}

@Injectable()
export class CreateTeacherUseCase {
  private readonly logger = new Logger(CreateTeacherUseCase.name);

  constructor(
    @Inject('TEACHER_REPOSITORY')
    private readonly teacherRepository: TeacherRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    @Inject('ROLE_REPOSITORY')
    private readonly roleRepository: RoleRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateTeacherInput): Promise<Teacher> {
    try {
      this.logger.log(`Creating teacher: ${input.fullName} (${input.teacherType})`);

      // Step 1: Check Teacher uniqueness (email/phone)
      await this.checkTeacherUniqueness(input);

      // Step 2: Create Teacher entity instance and save
      const teacher = await this.createAndSaveTeacher(input);
      this.logger.log(`Teacher created: ${teacher.id}`);

      // Step 3: Create User account with Clerk and assign role based on teacherType
      await this.createUserAccountWithRole(teacher);

      this.logger.log(
        `Teacher and User account created successfully for: ${input.email}`,
      );
      return teacher;
    } catch (error) {
      this.logger.error(
        `Failed to create teacher: ${error.message}`,
        error.stack,
      );
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  private async checkTeacherUniqueness(
    input: CreateTeacherInput,
  ): Promise<void> {
    const existingByEmail = await this.teacherRepository.findByEmail(
      input.email,
    );
    if (existingByEmail) {
      throw new ConflictException(
        `Teacher with email ${input.email} already exists`,
      );
    }

    const existingByPhone = await this.teacherRepository.findByPhoneNumber(
      input.phoneNumber,
    );
    if (existingByPhone) {
      throw new ConflictException(
        `Teacher with phone number ${input.phoneNumber} already exists`,
      );
    }
  }

  private async createAndSaveTeacher(input: CreateTeacherInput): Promise<Teacher> {
    const teacherEntity = Teacher.create({
      fullName: input.fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      teacherType: input.teacherType,
      address: input.address || null,
      dateOfBirth: input.dateOfBirth || null,
      gender: input.gender || null,
      startDate: input.startDate || null,
      userId: null,
    });

    return await this.teacherRepository.save(teacherEntity);
  }

  private async createUserAccountWithRole(teacher: Teacher): Promise<void> {
    try {
      this.logger.log(
        `Creating Clerk user for teacher: ${teacher.email} with weak password`,
      );

      // Create Clerk user
      const clerkUser = await this.identityService.provisionUser({
        email: teacher.email,
        fullName: teacher.fullName,
        phoneNumber: teacher.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });

      // Create User entity
      const userEntity = User.create({
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      });

      const user = await this.userRepository.save(userEntity);

      // Get the role ID based on teacher type
      const roleId = Teacher.getTeacherRoleId(teacher.teacherType);

      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        this.logger.warn(`Role ${roleId} not found, teacher will have no role assigned`);
      } else {
        // Assign role to user
        await this.userRepository.assignRoles(user.id, [roleId]);
        this.logger.log(`Assigned role ${roleId} to user ${user.id}`);
      }

      // Link Teacher to User
      teacher.linkUser(user.id);
      await this.teacherRepository.update(teacher);

      this.logger.log(
        `User account created for teacher: ${teacher.email} (Clerk UID: ${clerkUser.clerkUid})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create user account for teacher: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create user account: ${error.message}`,
      );
    }
  }
}
