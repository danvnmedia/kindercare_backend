import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  Role,
  CreateRoleData,
  RoleEntity,
} from "../../../../domain/user-management/role.entity";
import { RoleRepository } from "../../ports/role.repository";
import { CampusRepository } from "@/application/campus/ports/campus.repository";

export interface CreateRoleInput {
  name: string;
  description?: string;
  campusId?: string | null; // null for system default roles
  isSystemDefault?: boolean;
  isSystemRole?: boolean; // Should always be rejected from API - only set via seeds/migrations
  permissionIds?: string[]; // Permission IDs to assign
}

@Injectable()
export class CreateRoleUseCase {
  private readonly logger = new Logger(CreateRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(input: CreateRoleInput): Promise<Role> {
    try {
      // 0. Reject isSystemRole=true from API (security measure)
      if (input.isSystemRole === true) {
        throw new BadRequestException(
          "Cannot create system roles via API. System roles can only be created via database seeds or migrations.",
        );
      }

      // 1. Validate role name
      RoleEntity.validateName(input.name);
      const normalizedName = input.name.trim();
      const roleId = normalizedName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

      if (!roleId) {
        throw new BadRequestException(
          "Role name must contain alphanumeric characters",
        );
      }

      // 2. Validate campusId if provided
      const campusId = input.campusId ?? null;
      if (campusId !== null) {
        RoleEntity.validateCampusId(campusId);
        const campusExists = await this.campusRepository.exists(campusId);
        if (!campusExists) {
          throw new BadRequestException(`Campus with ID ${campusId} not found`);
        }
      }

      // 3. Check name uniqueness within campus scope
      const existingRole = await this.roleRepository.findByName(
        input.name,
        campusId,
      );
      if (existingRole) {
        const scopeMsg = campusId ? `campus ${campusId}` : "system defaults";
        throw new ConflictException(
          `Role with name "${input.name}" already exists in ${scopeMsg}`,
        );
      }

      // 4. Check ID uniqueness
      const existingRoleById = await this.roleRepository.findById(roleId);
      if (existingRoleById) {
        throw new ConflictException(`Role with id "${roleId}" already exists`);
      }

      // 5. Prepare role data
      const roleData: CreateRoleData = {
        id: roleId,
        name: normalizedName,
        description: input.description?.trim() || null,
        campusId,
        isSystemDefault: input.isSystemDefault ?? false,
        permissionIds: input.permissionIds,
      };

      // 6. Save role
      const savedRole = await this.roleRepository.save(roleData);

      this.logger.log(
        `Created role ${savedRole.id} (campus: ${savedRole.campusId ?? "system"})`,
      );

      return savedRole;
    } catch (error) {
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
