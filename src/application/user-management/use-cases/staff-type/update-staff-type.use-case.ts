import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { computeDiff } from "@/application/audit";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  StaffType,
  UpdateStaffTypeData,
} from "@/domain/user-management/entities/staff-type.entity";
import { User } from "@/domain/user-management/user.entity";
import { StaffTypeRepository } from "../../ports/staff-type.repository";
import { RoleRepository } from "../../ports/role.repository";
import {
  buildStaffTypeAuditContext,
  pickStaffTypeAuditFields,
} from "./staff-type-audit";
import { loadAllowedDefaultRole } from "./staff-type-default-role.policy";

export interface UpdateStaffTypeInput {
  campusId: string;
  name?: string;
  description?: string | null;
  defaultRoleId?: string | null;
  isArchived?: boolean;
  order?: number;
}

@Injectable()
export class UpdateStaffTypeUseCase {
  private readonly logger = new Logger(UpdateStaffTypeUseCase.name);

  constructor(
    @Inject("STAFF_TYPE_REPOSITORY")
    private readonly staffTypeRepository: StaffTypeRepository,
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    input: UpdateStaffTypeInput,
    currentUser: User,
  ): Promise<StaffType> {
    try {
      this.logger.log(`Updating staff type: ${id}`);

      // Find existing staff type
      const staffType = await this.staffTypeRepository.findById(id);
      if (!staffType) {
        throw new NotFoundException(`Staff type with ID "${id}" not found`);
      }
      if (staffType.campusId !== input.campusId) {
        throw new NotFoundException(
          `Staff type with ID "${id}" not found in this campus`,
        );
      }

      // Check for duplicate name if name is being changed
      if (input.name && input.name !== staffType.name) {
        const existingByName = await this.staffTypeRepository.findByName(
          input.campusId,
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
        await loadAllowedDefaultRole(
          this.roleRepository,
          input.defaultRoleId,
          input.campusId,
        );
      }

      // Validate order uniqueness if being changed
      if (input.order !== undefined && input.order !== staffType.order) {
        const existingByOrder =
          await this.staffTypeRepository.findByOrderAndCampus(
            input.order,
            input.campusId,
          );
        if (existingByOrder && existingByOrder.id !== id) {
          throw new ConflictException(
            `A staff type with order ${input.order} already exists in this campus`,
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
      if (input.isArchived !== undefined) {
        updateData.isArchived = input.isArchived;
      }
      if (input.order !== undefined) {
        updateData.order = input.order;
      }

      const beforeAudit = pickStaffTypeAuditFields(staffType);

      // Update domain entity (validation happens in entity)
      staffType.update(updateData);
      const diff = computeDiff(
        beforeAudit,
        pickStaffTypeAuditFields(staffType),
      );

      if (Object.keys(diff.after).length === 0) {
        this.logger.log(`No staff type changes detected for ${id}`);
        return staffType;
      }

      // Save and audit atomically.
      const updatedStaffType = await this.unitOfWork.run(async (tx) => {
        const updated = await tx.updateStaffType(staffType);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_STAFF_TYPE",
          targetType: "staff_type",
          targetId: updated.id,
          campusId: input.campusId,
          context: buildStaffTypeAuditContext(
            updated,
            input.campusId,
            currentUser,
          ),
          beforeValue: diff.before,
          afterValue: diff.after,
        });

        return updated;
      });
      this.logger.log(`Staff type updated: ${updatedStaffType.id}`);

      return updatedStaffType;
    } catch (error) {
      this.logger.error(
        `Failed to update staff type: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
