import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Student, StudentEntity } from '@/domain/user-management/student.entity';
import { StudentRepository } from '../../ports/student.repository';
import { GuardianRepository } from '../../ports/guardian.repository';
import { UserRepository } from '../../ports/user.repository';
import { IdentityService } from '@/infra/external-services/clerk/identity.service';

/**
 * Default weak password that forces user to reset on first login
 * This password is intentionally weak to violate most password policies
 * forcing the user to change it immediately
 */
const DEFAULT_WEAK_PASSWORD = 'ChangeMe123!';

export interface CreateStudentInput {
  // Personal information (now stored directly in Student)
  fullName: string;
  nickname?: string;
  dateOfBirth?: Date;
  gender?: string;
  phoneNumber?: string;
  email?: string;
  address?: string;

  // Student-specific info
  status?: string; // "WAITING", "ACTIVE", "INACTIVE", "GRADUATED"
  createUserAccount?: boolean;

  // Guardians
  guardianIds?: string[];
}

@Injectable()
export class CreateStudentUseCase {
  private readonly logger = new Logger(CreateStudentUseCase.name);

  constructor(
    @Inject('STUDENT_REPOSITORY')
    private readonly studentRepository: StudentRepository,
    @Inject('GUARDIAN_REPOSITORY')
    private readonly guardianRepository: GuardianRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateStudentInput): Promise<Student> {
    try {
      this.logger.log(
        `Creating student: ${input.fullName}`,
      );

      // ========== Step 1: Validate input data ==========
      this.validateInput(input);

      // ========== Step 2: Check Student uniqueness (email/phone) ==========
      await this.checkStudentUniqueness(input);

      // ========== Step 3: Validate guardians exist (if provided) ==========
      if (input.guardianIds && input.guardianIds.length > 0) {
        await this.validateGuardians(input.guardianIds);
      }

      // ========== Step 4: Create Student with all personal data ==========
      const student = await this.createStudent(input);
      this.logger.log(`Student created: ${student.id}`);

      // ========== Step 5: Assign Guardians (if provided) ==========
      if (input.guardianIds && input.guardianIds.length > 0) {
        await this.assignGuardians(student.id, input.guardianIds);
        this.logger.log(
          `Assigned ${input.guardianIds.length} guardians to student ${student.id}`,
        );
      }

      // ========== Step 6: Create User + Clerk (if requested) ==========
      if (input.createUserAccount) {
        await this.createUserAccount(student);
        this.logger.log(`User account created for student ${student.id}`);
      }

      // ========== Step 7: Return created student with relations ==========
      const createdStudent = await this.studentRepository.findById(student.id);
      if (!createdStudent) {
        throw new Error('Failed to retrieve created student');
      }

      this.logger.log(`Student creation completed: ${createdStudent.id}`);
      return createdStudent;
    } catch (error) {
      this.logger.error(`Failed to create student: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate input data (full name, email, phone, date of birth, gender, nickname)
   */
  private validateInput(input: CreateStudentInput): void {
    // Validate full name
    if (!StudentEntity.validateFullName(input.fullName)) {
      throw new BadRequestException(
        'Full name must be at least 2 characters and contain only valid characters',
      );
    }

    // Validate email format (if provided)
    if (input.email && !StudentEntity.validateEmail(input.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone number format (if provided)
    if (input.phoneNumber && !StudentEntity.validatePhoneNumber(input.phoneNumber)) {
      throw new BadRequestException(
        'Invalid phone number format (e.g., +84912345678)',
      );
    }

    // Validate gender
    if (input.gender && !StudentEntity.validateGender(input.gender)) {
      throw new BadRequestException('Gender must be MALE, FEMALE, or OTHER');
    }

    // Validate nickname
    if (input.nickname && !StudentEntity.validateNickname(input.nickname)) {
      throw new BadRequestException(
        'Nickname must be between 1 and 50 characters',
      );
    }

    // Validate date of birth (must be in the past)
    if (input.dateOfBirth && input.dateOfBirth >= new Date()) {
      throw new BadRequestException('Date of birth must be in the past');
    }
  }

  /**
   * Check Student uniqueness (email/phone)
   */
  private async checkStudentUniqueness(input: CreateStudentInput): Promise<void> {
    // Check email uniqueness (if provided)
    if (input.email) {
      const existingByEmail = await this.studentRepository.findByEmail(input.email);
      if (existingByEmail) {
        throw new ConflictException(
          `Student with email ${input.email} already exists`,
        );
      }
    }

    // Check phone uniqueness (if provided)
    if (input.phoneNumber) {
      const existingByPhone = await this.studentRepository.findByPhoneNumber(input.phoneNumber);
      if (existingByPhone) {
        throw new ConflictException(
          `Student with phone number ${input.phoneNumber} already exists`,
        );
      }
    }
  }

  /**
   * Validate that all guardian IDs exist
   */
  private async validateGuardians(guardianIds: string[]): Promise<void> {
    const guardians = await this.guardianRepository.findByIds(guardianIds);
    const foundIds = guardians.map((p) => p.id);
    const missingIds = guardianIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      throw new NotFoundException(
        `Guardians not found: ${missingIds.join(', ')}`,
      );
    }
  }

  /**
   * Create Student with all personal information
   */
  private async createStudent(input: CreateStudentInput): Promise<Student> {
    const studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
      studentCode: randomUUID(),
      // Personal information (now stored directly in Student)
      fullName: input.fullName.trim(),
      email: input.email?.trim() || null,
      phoneNumber: input.phoneNumber?.trim() || null,
      address: input.address?.trim() || null,
      dateOfBirth: input.dateOfBirth || null,

      // Student-specific data
      nickname: input.nickname?.trim() || null,
      gender: input.gender || null,
      status: input.status || 'WAITING',
      isArchived: false,
    };

    return await this.studentRepository.save(studentData);
  }

  /**
   * Assign guardians to student
   * Default relationship is "GUARDIAN" if not specified
   */
  private async assignGuardians(
    studentId: string,
    guardianIds: string[],
  ): Promise<void> {
    const guardianRelations = guardianIds.map((guardianId) => ({
      guardianId,
      relationshipId: 'GUARDIAN', // Default to GUARDIAN, can be customized later
    }));

    await this.studentRepository.assignGuardians(studentId, guardianRelations);
  }

  /**
   * Create User account + Clerk identity with weak password
   * The weak password forces the user to change it on first login
   */
  private async createUserAccount(student: Student): Promise<void> {
    try {
      // Validate that email or phone is provided for Clerk
      if (!student.email && !student.phoneNumber) {
        throw new BadRequestException(
          'Email or phone number is required to create user account',
        );
      }

      // Create Clerk user with weak password
      this.logger.log(
        `Creating Clerk user for student: ${student.email || student.phoneNumber} with weak password`,
      );

      const clerkUser = await this.identityService.provisionUser({
        email: student.email || undefined,
        fullName: student.fullName,
        phoneNumber: student.phoneNumber || undefined,
        password: DEFAULT_WEAK_PASSWORD,
      });

      // Create User in database
      const userData: any = {
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      };

      await this.userRepository.save(userData);

      this.logger.log(
        `User account created for student: ${student.email || student.phoneNumber} (Clerk UID: ${clerkUser.clerkUid})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create user account for student: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create user account: ${error.message}`,
      );
    }
  }
}
