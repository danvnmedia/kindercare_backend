import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import {
  Role,
  UpdateRoleData,
  RoleEntity,
} from "../../../../domain/user-management/role.entity";
import { RoleRepository } from "../../ports/role.repository";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";
import { CampusRepository } from "@/application/campus/ports/campus.repository";

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  campusId?: string | null;
}

@Injectable()
export class UpdateRoleUseCase {
  private readonly logger = new Logger(UpdateRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(id: string, input: UpdateRoleInput): Promise<Role> {
    try {
      // 1. Find existing role
      const currentRole = await this.roleRepository.findById(id);
      if (!currentRole) {
        throw new RoleNotFoundException(id);
      }

      // 2. Check if role is system default or system role (cannot be modified)
      if (currentRole.isSystemDefault) {
        throw new BadRequestException(
          "System default roles cannot be modified",
        );
      }
      if (currentRole.isSystemRole) {
        throw new BadRequestException(
          "System roles cannot be modified via API",
        );
      }

      // 3. Validate name if provided
      if (input.name) {
        RoleEntity.validateName(input.name);

        // Check name uniqueness within campus scope (if name changed)
        if (input.name !== currentRole.name) {
          const campusId =
            input.campusId !== undefined
              ? input.campusId
              : currentRole.campusId;
          const existingRole = await this.roleRepository.findByName(
            input.name,
            campusId,
          );
          if (existingRole && existingRole.id !== id) {
            const scopeMsg = campusId
              ? `campus ${campusId}`
              : "system defaults";
            throw new ConflictException(
              `Role with name "${input.name}" already exists in ${scopeMsg}`,
            );
          }
        }
      }

      // 4. Validate and check campusId if provided
      if (input.campusId !== undefined && input.campusId !== null) {
        RoleEntity.validateCampusId(input.campusId);
        const campusExists = await this.campusRepository.exists(input.campusId);
        if (!campusExists) {
          throw new BadRequestException(
            `Campus with ID ${input.campusId} not found`,
          );
        }
      }

      // 5. Prepare update data
      const updateData: UpdateRoleData = {
        name: input.name?.trim(),
        description: input.description?.trim(),
        campusId: input.campusId,
      };

      // 6. Update role
      const updatedRole = await this.roleRepository.update(id, updateData);

      this.logger.log(`Updated role ${id}`);

      return updatedRole;
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      if (
        error.message?.includes("cannot be empty") ||
        error.message?.includes("must be at least")
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}
