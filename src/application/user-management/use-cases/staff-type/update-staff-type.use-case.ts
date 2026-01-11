import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  StaffType,
  UpdateStaffTypeData,
} from "@/domain/user-management/entities/staff-type.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";

export interface UpdateStaffTypeInput {
  name?: string;
  description?: string | null;
  defaultRoleId?: string | null;
  isActive?: boolean;
}

@Injectable()
export class UpdateStaffTypeUseCase {
  private readonly logger = new Logger(UpdateStaffTypeUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
  ) {}

  async execute(id: string, input: UpdateStaffTypeInput): Promise<StaffType> {
    try {
      this.logger.log(`Updating staff type: ${id}`);

      // Find existing staff type
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID "${id}" not found`);
      }

      // Check for duplicate name if name is being changed
      if (input.name && input.name !== staffType.name) {
        const existingByName = await this.staffTypeRepository.findByName(
          staffType.campusId,
          input.name,
        );
        if (existingByName && existingByName.id !== id) {
          throw new ConflictException(
            `Staff type "${input.name}" already exists in this campus`,
          );
        }
      }

      // Validate defaultRoleId if provided
      if (input.defaultRoleId !== undefined && input.defaultRoleId !== null) {
        const roleExists = await this.roleRepository.exists(
          input.defaultRoleId,
        );
        if (!roleExists) {
          throw new NotFoundException(
            `Role with ID "${input.defaultRoleId}" not found`,
          );
        }
      }

      // Build update data
      const updateData: UpdateStaffTypeData = {};

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.description !== undefined) {
        updateData.description = input.description;
      }
      if (input.defaultRoleId !== undefined) {
        updateData.defaultRoleId = input.defaultRoleId;
      }
      if (input.isActive !== undefined) {
        updateData.isActive = input.isActive;
      }

      // Update domain entity (validation happens in entity)
      staffType.update(updateData);

      // Save to repository
      const updatedStaffType = await this.staffTypeRepository.update(staffType);
      this.logger.log(`Staff type updated: ${updatedStaffType.id}`);

      return updatedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to update staff type: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
