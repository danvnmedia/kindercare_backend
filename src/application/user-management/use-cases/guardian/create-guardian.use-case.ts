import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Guardian } from "@/domain/user-management/entities/guardian.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { GuardianRepository } from "../../ports/guardian.repository";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

export interface CreateGuardianInput {
  fullName: string;
  dateOfBirth: Date;
  gender: Gender;
  phoneNumber: string;
  email?: string;
  address?: string;
  occupation?: string;
  workAddress?: string;
}

interface ClerkUserResult {
  clerkUid: string;
}

@Injectable()
export class CreateGuardianUseCase {
  private readonly logger = new Logger(CreateGuardianUseCase.name);

  constructor(
    @Inject("GUARDIAN_REPOSITORY")
    private readonly guardianRepository: GuardianRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(input: CreateGuardianInput): Promise<Guardian> {
    this.logger.log(`Creating guardian: ${input.fullName}`);

    // Step 1: Validate age
    if (input.dateOfBirth && this.calculateAge(input.dateOfBirth) < 18) {
      throw new BadRequestException("Guardian must be at least 18 years old");
    }

    // Step 2: Check Guardian uniqueness (email/phone)
    await this.checkGuardianUniqueness(input);

    // Step 3: Create Clerk user FIRST (external service - most likely to fail)
    const clerkUser = await this.createClerkUser(input);
    const identifier = input.email || input.phoneNumber;

    try {
      // Step 4: DB Transaction - Create User + Guardian atomically using UnitOfWork
      const guardian = await this.unitOfWork.run(async (tx) => {
        // Create User entity with clerkUid
        const user = await tx.createUser({
          clerkUid: clerkUser.clerkUid,
          isActive: true,
        });
        this.logger.log(`User created in transaction: ${user.id}`);

        // Create Guardian domain entity with userId already linked
        const guardianEntity = Guardian.create({
          fullName: input.fullName,
          email: input.email || null,
          phoneNumber: input.phoneNumber,
          address: input.address || null,
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          occupation: input.occupation || null,
          workAddress: input.workAddress || null,
          spouseId: null,
          userId: user.id, // Link immediately - no separate update needed
        });

        // Persist Guardian using transaction context
        const createdGuardian = await tx.createGuardian({
          id: guardianEntity.id,
          fullName: guardianEntity.fullName,
          email: guardianEntity.email,
          phoneNumber: guardianEntity.phoneNumber,
          address: guardianEntity.address,
          dateOfBirth: guardianEntity.dateOfBirth,
          gender: guardianEntity.gender,
          occupation: guardianEntity.occupation,
          workAddress: guardianEntity.workAddress,
          spouseId: guardianEntity.spouseId,
          userId: guardianEntity.userId,
          isArchived: guardianEntity.isArchived,
          createdAt: guardianEntity.createdAt,
          updatedAt: guardianEntity.updatedAt,
        });

        this.logger.log(
          `Guardian created in transaction: ${createdGuardian.id}`,
        );

        return guardianEntity;
      });

      this.logger.log(
        `Guardian and User account created successfully for: ${identifier}`,
      );
      return guardian;
    } catch (error) {
      // Step 5: Compensation - Delete Clerk user if DB transaction fails
      this.logger.error(
        `DB transaction failed, compensating by deleting Clerk user: ${clerkUser.clerkUid}`,
      );
      await this.compensateClerkUser(clerkUser.clerkUid);

      this.logger.error(
        `Failed to create guardian: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create guardian: ${error.message}`,
      );
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
    // Check email uniqueness only if email is provided
    if (input.email) {
      const existingByEmail = await this.guardianRepository.findByEmail(
        input.email,
      );
      if (existingByEmail) {
        throw new ConflictException(
          `Guardian with email ${input.email} already exists`,
        );
      }
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

  private async createClerkUser(
    input: CreateGuardianInput,
  ): Promise<ClerkUserResult> {
    const identifier = input.email || input.phoneNumber;
    this.logger.log(`Creating Clerk user for: ${identifier}`);

    try {
      const clerkUser = await this.identityPort.provisionUser({
        email: input.email || undefined,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });

      this.logger.log(`Clerk user created: ${clerkUser.clerkUid}`);
      return clerkUser;
    } catch (error) {
      this.logger.error(
        `Failed to create Clerk user: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create identity account: ${error.message}`,
      );
    }
  }

  private async compensateClerkUser(clerkUid: string): Promise<void> {
    try {
      await this.identityPort.deleteIdentity(clerkUid);
      this.logger.log(
        `Compensation successful: Clerk user deleted: ${clerkUid}`,
      );
    } catch (compensationError) {
      // Log but don't throw - compensation is best effort
      // This could be handled by a dead letter queue in production
      this.logger.error(
        `Compensation FAILED: Could not delete Clerk user ${clerkUid}. Manual cleanup required.`,
        compensationError.stack,
      );
    }
  }
}
