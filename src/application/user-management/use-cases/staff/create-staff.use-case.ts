import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { StaffRepository } from "../../ports/staff.repository";

const DEFAULT_WEAK_PASSWORD = "ChangeMe123!";

export interface CreateStaffInput {
  fullName: string;
  email: string;
  phoneNumber: string;
  staffType: StaffType;
  address?: string;
  dateOfBirth?: Date;
  gender?: Gender;
  startDate?: Date;
}

interface ClerkUserResult {
  clerkUid: string;
}

@Injectable()
export class CreateStaffUseCase {
  private readonly logger = new Logger(CreateStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(input: CreateStaffInput): Promise<Staff> {
    this.logger.log(`Creating staff: ${input.fullName} (${input.staffType})`);

    // Step 1: Check Staff uniqueness (email/phone)
    await this.checkStaffUniqueness(input);

    // Step 2: Create Clerk user FIRST (external service - most likely to fail)
    const clerkUser = await this.createClerkUser(input);

    try {
      // Step 3: DB Transaction - Create User + Staff + Role assignment atomically using UnitOfWork
      const staff = await this.unitOfWork.run(async (tx) => {
        // Create User entity with clerkUid
        const user = await tx.createUser({
          clerkUid: clerkUser.clerkUid,
          isActive: true,
        });
        this.logger.log(`User created in transaction: ${user.id}`);

        // Create Staff domain entity with userId already linked
        const staffEntity = Staff.create({
          fullName: input.fullName,
          email: input.email,
          phoneNumber: input.phoneNumber,
          staffType: input.staffType,
          address: input.address || null,
          dateOfBirth: input.dateOfBirth || null,
          gender: input.gender || null,
          startDate: input.startDate || null,
          userId: user.id, // Link immediately - no separate update needed
        });

        // Persist Staff using transaction context
        const createdStaff = await tx.createStaff({
          id: staffEntity.id,
          fullName: staffEntity.fullName,
          email: staffEntity.email,
          phoneNumber: staffEntity.phoneNumber,
          staffType: staffEntity.staffType,
          address: staffEntity.address,
          dateOfBirth: staffEntity.dateOfBirth,
          gender: staffEntity.gender,
          startDate: staffEntity.startDate,
          userId: staffEntity.userId,
          isArchived: staffEntity.isArchived,
          createdAt: staffEntity.createdAt,
          updatedAt: staffEntity.updatedAt,
        });

        this.logger.log(`Staff created in transaction: ${createdStaff.id}`);

        // Assign role based on staffType
        const roleId = Staff.getStaffRoleId(input.staffType);
        await tx.assignRoles(user.id, [roleId]);
        this.logger.log(`Assigned role ${roleId} to user ${user.id}`);

        return staffEntity;
      });

      this.logger.log(
        `Staff and User account created successfully for: ${input.email}`,
      );
      return staff;
    } catch (error) {
      // Step 4: Compensation - Delete Clerk user if DB transaction fails
      this.logger.error(
        `DB transaction failed, compensating by deleting Clerk user: ${clerkUser.clerkUid}`,
      );
      await this.compensateClerkUser(clerkUser.clerkUid);

      this.logger.error(
        `Failed to create staff: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Failed to create staff: ${error.message}`);
    }
  }

  private async checkStaffUniqueness(input: CreateStaffInput): Promise<void> {
    const existingByEmail = await this.staffRepository.findByEmail(input.email);
    if (existingByEmail) {
      throw new ConflictException(
        `Staff with email ${input.email} already exists`,
      );
    }

    const existingByPhone = await this.staffRepository.findByPhoneNumber(
      input.phoneNumber,
    );
    if (existingByPhone) {
      throw new ConflictException(
        `Staff with phone number ${input.phoneNumber} already exists`,
      );
    }
  }

  private async createClerkUser(
    input: CreateStaffInput,
  ): Promise<ClerkUserResult> {
    this.logger.log(`Creating Clerk user for staff: ${input.email}`);

    try {
      const clerkUser = await this.identityPort.provisionUser({
        email: input.email,
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
