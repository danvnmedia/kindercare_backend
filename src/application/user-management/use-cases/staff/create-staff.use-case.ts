import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import { User } from "@/domain/user-management/user.entity";
import { StaffRepository } from "../../ports/staff.repository";
import { UserRepository } from "../../ports/user.repository";
import { RoleRepository } from "../../ports/role.repository";
import { IdentityService } from "@/infra/external-services/clerk/identity.service";

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

@Injectable()
export class CreateStaffUseCase {
  private readonly logger = new Logger(CreateStaffUseCase.name);

  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    private readonly identityService: IdentityService,
  ) {}

  async execute(input: CreateStaffInput): Promise<Staff> {
    try {
      this.logger.log(
        `Creating staff: ${input.fullName} (${input.staffType})`,
      );

      // Step 1: Check Staff uniqueness (email/phone)
      await this.checkStaffUniqueness(input);

      // Step 2: Create Staff entity instance and save
      const staff = await this.createAndSaveStaff(input);
      this.logger.log(`Staff created: ${staff.id}`);

      // Step 3: Create User account with Clerk and assign role based on staffType
      await this.createUserAccountWithRole(staff);

      this.logger.log(
        `Staff and User account created successfully for: ${input.email}`,
      );
      return staff;
    } catch (error) {
      this.logger.error(
        `Failed to create staff: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  private async checkStaffUniqueness(
    input: CreateStaffInput,
  ): Promise<void> {
    const existingByEmail = await this.staffRepository.findByEmail(
      input.email,
    );
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

  private async createAndSaveStaff(
    input: CreateStaffInput,
  ): Promise<Staff> {
    const staffEntity = Staff.create({
      fullName: input.fullName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      staffType: input.staffType,
      address: input.address || null,
      dateOfBirth: input.dateOfBirth || null,
      gender: input.gender || null,
      startDate: input.startDate || null,
      userId: null,
    });

    return await this.staffRepository.save(staffEntity);
  }

  private async createUserAccountWithRole(staff: Staff): Promise<void> {
    try {
      this.logger.log(
        `Creating Clerk user for staff: ${staff.email} with weak password`,
      );

      // Create Clerk user
      const clerkUser = await this.identityService.provisionUser({
        email: staff.email,
        fullName: staff.fullName,
        phoneNumber: staff.phoneNumber,
        password: DEFAULT_WEAK_PASSWORD,
      });

      // Create User entity
      const userEntity = User.create({
        clerkUid: clerkUser.clerkUid,
        isActive: true,
      });

      const user = await this.userRepository.save(userEntity);

      // Get the role ID based on staff type
      const roleId = Staff.getStaffRoleId(staff.staffType);

      // Verify role exists
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        this.logger.warn(
          `Role ${roleId} not found, staff will have no role assigned`,
        );
      } else {
        // Assign role to user
        await this.userRepository.assignRoles(user.id, [roleId]);
        this.logger.log(`Assigned role ${roleId} to user ${user.id}`);
      }

      // Link Staff to User
      staff.linkUser(user.id);
      await this.staffRepository.update(staff);

      this.logger.log(
        `User account created for staff: ${staff.email} (Clerk UID: ${clerkUser.clerkUid})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to create user account for staff: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(
        `Failed to create user account: ${error.message}`,
      );
    }
  }
}
