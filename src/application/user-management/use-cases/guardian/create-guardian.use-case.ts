import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import { GuardianRepository } from "../../ports/guardian.repository";
import { UserRepository } from "../../ports/user.repository";
import { IdentityService } from "@/infra/external-services/clerk/identity.service";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

export interface CreateGuardianInput {
  fullName: string;
  dateOfBirth: Date;
  gender: Gender;
  phoneNumber: string;
  email: string;
  address?: string;
  occupation?: string;
  workAddress?: string;
}

@Injectable()
export class CreateGuardianUseCase {
  private readonly logger = new Logger(CreateGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateGuardianInput): Promise<Guardian> {
    try {
      this.logger.log(`Creating guardian: ${input.fullName}`);

      // Step 1: Validate age (business rule beyond entity creation)
      if (input.dateOfBirth && this.calculateAge(input.dateOfBirth) < 18) {
        throw new BadRequestException("Guardian must be at least 18 years old");
      }

      // Step 2: Check Guardian uniqueness (email/phone)
      await this.checkGuardianUniqueness(input);

      // Step 3: Create Guardian entity instance and save
      const guardian = await this.createAndSaveGuardian(input);
      this.logger.log(`Guardian created: ${guardian.id}`);

      // Step 4: Create User account with Clerk (if email/phone provided)
      await this.createUserAccount(guardian);

      this.logger.log(
        `Guardian and User account created successfully for: ${input.email}`,
      );
      return guardian;
    } catch (error) {
      this.logger.error(
        `Failed to create guardian: ${error.message}`,
        error.stack,
      );
      // Re-throw specific exceptions or a generic one
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      // Catch errors from Guardian.create() and wrap them in BadRequestException
      throw new BadRequestException(error.message);
    }
  }

  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return age;
  }

  private async checkGuardianUniqueness(
    input: CreateGuardianInput,
  ): Promise<void> {
    const existingByEmail = await this.guardianRepository.findByEmail(
      input.email,
    );
    if (existingByEmail) {
      throw new ConflictException(
        `Guardian with email ${input.email} already exists`,
      );
    }

    const existingByPhone = await this.guardianRepository.findByPhoneNumber(
      input.phoneNumber,
    );
    if (existingByPhone) {
      throw new ConflictException(
        `Guardian with phone number ${input.phoneNumber} already exists`,
      );
    }
  }

  private async createAndSaveGuardian(
    input: CreateGuardianInput,
  ): Promise<Guardian> {
    const guardianEntity = Guardian.create({
      fullName: input.fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      address: input.address || null,
      dateOfBirth: input.dateOfBirth,
      gender: input.gender,
      occupation: input.occupation || null,
      workAddress: input.workAddress || null,
      spouseId: null,
      userId: null,
    });

    return await this.guardianRepository.save(guardianEntity);
  }

  private async createUserAccount(guardian: Guardian): Promise<void> {
    try {
      this.logger.log(
        `Creating Clerk user for guardian: ${guardian.email} with weak password`,
      );

      const clerkUser = await this.identityService.provisionUser({
        email: guardian.email,
        fullName: guardian.fullName,
        phoneNumber: guardian.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });

      const userEntity = User.create({
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      });

      const user = await this.userRepository.save(userEntity);

      // Link Guardian to User
      // Update the existing guardian entity instance and save it
      guardian.updateProfile({ userId: user.id }); // Use instance method for update
      await this.guardianRepository.update(guardian);

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
