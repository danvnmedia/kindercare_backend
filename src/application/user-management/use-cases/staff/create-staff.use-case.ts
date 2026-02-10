import { IdentityPort } from "@/application/ports/identity.port";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { generateSecurePassword } from "@/core/utils/security.utils";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { StaffRepository } from "../../ports/staff.repository";
import { StaffTypeRepository } from "../../ports/staff-type.repository";

export interface CreateStaffInput {
  campusId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  staffTypeId?: string;
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
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly identityPort: IdentityPort,
  ) {}

  async execute(input: CreateStaffInput): Promise<Staff> {
    this.logger.log(
      `Creating staff: ${input.fullName} in campus ${input.campusId}`,
    );

    // Step 1: Validate staffTypeId if provided (must exist and be active)
    let defaultRoleId: string | null = null;
    if (input.staffTypeId) {
      const staffType = await this.staffTypeRepository.findById(
        input.staffTypeId,
      );
      if (!staffType) {
        throw new NotFoundException(
          `Staff type with ID ${input.staffTypeId} not found`,
        );
      }
      if (!staffType.isActive) {
        throw new BadRequestException(
          `Staff type ${staffType.name} is inactive`,
        );
      }
      if (staffType.campusId !== input.campusId) {
        throw new BadRequestException(
          `Staff type ${staffType.name} does not belong to the specified campus`,
        );
      }
      // Get default role for auto-assignment
      defaultRoleId = staffType.defaultRoleId;
      this.logger.log(
        `Staff type validated: ${staffType.name}, defaultRoleId: ${defaultRoleId}`,
      );
    }

    // Step 2: Check Staff uniqueness (email/phone within campus)
    await this.checkStaffUniqueness(input);

    // Step 3: Create Clerk user FIRST (external service - most likely to fail)
    const clerkUser = await this.createClerkUser(input);

    try {
      // Step 4: DB Transaction - Create User + Staff + Role assignment atomically using UnitOfWork
      const staff = await this.unitOfWork.run(async (tx) => {
        // Create User entity with clerkUid
        const user = await tx.createUser({
          clerkUid: clerkUser.clerkUid,
          isActive: true,
        });
        this.logger.log(`User created in transaction: ${user.id}`);

        // Create Staff domain entity with userId already linked
        const staffEntity = Staff.create({
          campusId: input.campusId,
          fullName: input.fullName,
          email: input.email,
          phoneNumber: input.phoneNumber,
          staffTypeId: input.staffTypeId || null,
          address: input.address || null,
          dateOfBirth: input.dateOfBirth || null,
          gender: input.gender || null,
          startDate: input.startDate || null,
          userId: user.id, // Link immediately - no separate update needed
        });

        // Persist Staff using transaction context
        const createdStaff = await tx.createStaff({
          id: staffEntity.id,
          campusId: staffEntity.campusId,
          fullName: staffEntity.fullName,
          email: staffEntity.email,
          phoneNumber: staffEntity.phoneNumber,
          staffTypeId: staffEntity.staffTypeId,
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

        // Auto-assign role from staffType.defaultRoleId if available
        // Role is scoped to the staff's campus
        if (defaultRoleId) {
          await tx.assignRoles(user.id, [
            { roleId: defaultRoleId, campusId: input.campusId },
          ]);
          this.logger.log(
            `Auto-assigned default role ${defaultRoleId} to user ${user.id} in campus ${input.campusId}`,
          );
        }

        return staffEntity;
      });

      this.logger.log(
        `Staff and User account created successfully for: ${input.email}`,
      );
      return staff;
    } catch (error) {
      // Step 5: Compensation - Delete Clerk user if DB transaction fails
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
    // Check email uniqueness within the same campus
    const existingByEmail = await this.staffRepository.findByEmailInCampus(
      input.campusId,
      input.email,
    );
    if (existingByEmail) {
      throw new ConflictException(
        `Staff with email ${input.email} already exists in this campus`,
      );
    }

    // Check phone uniqueness within the same campus
    const existingByPhone =
      await this.staffRepository.findByPhoneNumberInCampus(
        input.campusId,
        input.phoneNumber,
      );
    if (existingByPhone) {
      throw new ConflictException(
        `Staff with phone number ${input.phoneNumber} already exists in this campus`,
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
        password: generateSecurePassword(),
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
