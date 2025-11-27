import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Parent, ParentEntity } from '@/domain/user-management/parent.entity';
import { ParentRepository } from '../../ports/parent.repository';
import { UserRepository } from '../../ports/user.repository';
import { IdentityService } from '@/infra/external-services/clerk/identity.service';

/**
 * Default weak password that forces user to reset on first login
 * This password is intentionally weak to violate most password policies
 * forcing the user to change it immediately
 */
const DEFAULT_WEAK_PASSWORD = 'ChangeMe123!';

export interface CreateParentInput {
  // Personal information
  fullName: string;
  dateOfBirth: Date;
  gender: string;
  phoneNumber: string;
  email: string;
  address?: string;

  // Parent-specific data
  occupation?: string;
  workAddress?: string;
}

@Injectable()
export class CreateParentUseCase {
  private readonly logger = new Logger(CreateParentUseCase.name);

  constructor(
    @Inject('PARENT_REPOSITORY')
    private readonly parentRepository: ParentRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateParentInput): Promise<Parent> {
    try {
      this.logger.log(`Creating parent: ${input.fullName}`);

      // ========== Step 1: Validate input data ==========
      this.validateInput(input);

      // ========== Step 2: Check Parent uniqueness (email/phone) ==========
      await this.checkParentUniqueness(input);

      // ========== Step 3: Create Parent ==========
      const parent = await this.createParent(input);
      this.logger.log(`Parent created: ${parent.id}`);

      // ========== Step 4: Create User account with Clerk ==========
      await this.createUserAccount(parent);

      this.logger.log(`Parent and User account created successfully for: ${input.email}`);
      return parent;
    } catch (error) {
      this.logger.error(`Failed to create parent: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate input data (full name, email, phone, date of birth, gender)
   */
  private validateInput(input: CreateParentInput): void {
    // Validate full name
    if (!ParentEntity.validateFullName(input.fullName)) {
      throw new BadRequestException(
        'Full name must be at least 2 characters and contain only valid characters',
      );
    }

    // Validate email format
    if (!ParentEntity.validateEmail(input.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Validate phone number format
    if (!ParentEntity.validatePhoneNumber(input.phoneNumber)) {
      throw new BadRequestException(
        'Invalid phone number format (e.g., +84912345678)',
      );
    }

    // Validate date of birth (must be in the past)
    if (input.dateOfBirth >= new Date()) {
      throw new BadRequestException('Date of birth must be in the past');
    }

    // Validate parent is adult (>= 18 years old)
    const age = this.calculateAge(input.dateOfBirth);
    if (age < 18) {
      throw new BadRequestException('Parent must be at least 18 years old');
    }

    // Validate gender
    if (input.gender && !ParentEntity.validateGender(input.gender)) {
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
   * Check Parent uniqueness (email/phone)
   */
  private async checkParentUniqueness(input: CreateParentInput): Promise<void> {
    // Check email uniqueness
    const existingByEmail = await this.parentRepository.findByEmail(input.email);
    if (existingByEmail) {
      throw new ConflictException(
        `Parent with email ${input.email} already exists`,
      );
    }

    // Check phone uniqueness
    const existingByPhone = await this.parentRepository.findByPhoneNumber(input.phoneNumber);
    if (existingByPhone) {
      throw new ConflictException(
        `Parent with phone number ${input.phoneNumber} already exists`,
      );
    }
  }

  /**
   * Create Parent
   */
  private async createParent(input: CreateParentInput): Promise<Parent> {
    const parentData: Omit<Parent, 'id' | 'createdAt' | 'updatedAt' | 'spouse'> = {
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

    return await this.parentRepository.save(parentData);
  }

  /**
   * Create User account + Clerk identity with weak password
   * The weak password forces the user to change it on first login
   */
  private async createUserAccount(parent: Parent): Promise<void> {
    try {
      // Create Clerk user with weak password
      this.logger.log(
        `Creating Clerk user for parent: ${parent.email} with weak password`,
      );

      const clerkUser = await this.identityService.provisionUser({
        email: parent.email,
        fullName: parent.fullName,
        phoneNumber: parent.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });

      // Create User in database
      const userData: any = {
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      };

      const user = await this.userRepository.save(userData);

      // Link Parent to User
      await this.parentRepository.update(parent.id, { userId: user.id });

      this.logger.log(
        `User account created for parent: ${parent.email} (Clerk UID: ${clerkUser.clerkUid})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create user account for parent: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create user account: ${error.message}`,
      );
    }
  }
}
