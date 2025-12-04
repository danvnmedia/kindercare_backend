import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Guardian, GuardianEntity } from '@/domain/user-management/guardian.entity';
import { GuardianRepository } from '../../ports/guardian.repository';
import { UserRepository } from '../../ports/user.repository';
import { IdentityService } from '@/infra/external-services/clerk/identity.service';

/**
 * Default weak password that forces user to reset on first login
 * This password is intentionally weak to violate most password policies
 * forcing the user to change it immediately
 */
const DEFAULT_WEAK_PASSWORD = 'ChangeMe123!';

export interface CreateGuardianInput {
  // Personal information
  fullName: string;
  dateOfBirth: Date;
  gender: string;
  phoneNumber: string;
  email: string;
  address?: string;

  // Guardian-specific data
  occupation?: string;
  workAddress?: string;
}

@Injectable()
export class CreateGuardianUseCase {
  private readonly logger = new Logger(CreateGuardianUseCase.name);

  constructor(
    @Inject('GUARDIAN_REPOSITORY')
    private readonly guardianRepository: GuardianRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateGuardianInput): Promise<Guardian> {
    try {
      this.logger.log(`Creating guardian: ${input.fullName}`);

      // ========== Step 1: Validate input data ==========
      this.validateInput(input);

      // ========== Step 2: Check Guardian uniqueness (email/phone) ==========
      await this.checkGuardianUniqueness(input);

      // ========== Step 3: Create Guardian ==========
      const guardian = await this.createGuardian(input);
      this.logger.log(`Guardian created: ${guardian.id}`);

      // ========== Step 4: Create User account with Clerk ==========
      await this.createUserAccount(guardian);

      this.logger.log(`Guardian and User account created successfully for: ${input.email}`);
      return guardian;
    } catch (error) {
      this.logger.error(`Failed to create guardian: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate input data (full name, email, phone, date of birth, gender)
   */
  private validateInput(input: CreateGuardianInput): void {
    // Validate full name
    if (!GuardianEntity.validateFullName(input.fullName)) {
      throw new BadRequestException(
        'Full name must be at least 2 characters and contain only valid characters',
      );
    }

    // Validate email format
    if (!GuardianEntity.validateEmail(input.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone number format
    if (!GuardianEntity.validatePhoneNumber(input.phoneNumber)) {
      throw new BadRequestException(
        'Invalid phone number format (e.g., +84912345678)',
      );
    }

    // Validate date of birth (must be in the past)
    if (input.dateOfBirth >= new Date()) {
      throw new BadRequestException('Date of birth must be in the past');
    }

    // Validate guardian is adult (>= 18 years old)
    const age = this.calculateAge(input.dateOfBirth);
    if (age < 18) {
      throw new BadRequestException('Guardian must be at least 18 years old');
    }

    // Validate gender
    if (input.gender && !GuardianEntity.validateGender(input.gender)) {
      throw new BadRequestException('Invalid gender value (MALE, FEMALE, OTHER)');
    }
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age;
  }

  /**
   * Check Guardian uniqueness (email/phone)
   */
  private async checkGuardianUniqueness(input: CreateGuardianInput): Promise<void> {
    // Check email uniqueness
    const existingByEmail = await this.guardianRepository.findByEmail(input.email);
    if (existingByEmail) {
      throw new ConflictException(
        `Guardian with email ${input.email} already exists`,
      );
    }

    // Check phone uniqueness
    const existingByPhone = await this.guardianRepository.findByPhoneNumber(input.phoneNumber);
    if (existingByPhone) {
      throw new ConflictException(
        `Guardian with phone number ${input.phoneNumber} already exists`,
      );
    }
  }

  /**
   * Create Guardian
   */
  private async createGuardian(input: CreateGuardianInput): Promise<Guardian> {
    const guardianData: Omit<Guardian, 'id' | 'createdAt' | 'updatedAt' | 'spouse'> = {
      fullName: input.fullName.trim(),
      email: input.email.trim(),
      phoneNumber: input.phoneNumber.trim(),
      address: input.address?.trim() || null,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender || null,
      occupation: input.occupation?.trim() || null,
      workAddress: input.workAddress?.trim() || null,
      spouseId: null, // Can be set later
      userId: null, // Will be set after creating User account
      isArchived: false,
    };

    return await this.guardianRepository.save(guardianData);
  }

  /**
   * Create User account + Clerk identity with weak password
   * The weak password forces the user to change it on first login
   */
  private async createUserAccount(guardian: Guardian): Promise<void> {
    try {
      // Create Clerk user with weak password
      this.logger.log(
        `Creating Clerk user for guardian: ${guardian.email} with weak password`,
      );

      const clerkUser = await this.identityService.provisionUser({
        email: guardian.email,
        fullName: guardian.fullName,
        phoneNumber: guardian.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });

      // Create User in database
      const userData: any = {
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      };

      const user = await this.userRepository.save(userData);

      // Link Guardian to User
      await this.guardianRepository.update(guardian.id, { userId: user.id });

      this.logger.log(
        `User account created for guardian: ${guardian.email} (Clerk UID: ${clerkUser.clerkUid})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create user account for guardian: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create user account: ${error.message}`,
      );
    }
  }
}
