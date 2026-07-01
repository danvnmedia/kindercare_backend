import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Role,
  CreateRoleData,
  RoleEntity,
} from "../../../../domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";
import { RoleRepository } from "../../ports/role.repository";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import { buildRoleAuditContext, pickRoleAuditFields } from "./role-audit";

export interface CreateRoleInput {
  name: string;
  description?: string;
  campusId: string;
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
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(input: CreateRoleInput, currentUser: User): Promise<Role> {
    try {
      // 0. API-created roles are always campus-scoped, mutable roles.
      if (input.isSystemRole === true) {
        throw new BadRequestException(
          "Cannot create system roles via API. System roles can only be created via database seeds or migrations.",
        );
      }
      if (input.isSystemDefault === true) {
        throw new BadRequestException(
          "Cannot create system default roles via API. System default roles can only be created via database seeds or migrations.",
        );
      }

      // 1. Validate role name
      RoleEntity.validateName(input.name);
      const normalizedName = input.name.trim();

      // 2. Validate campusId from the request context, not the request body.
      const campusId = input.campusId;
      RoleEntity.validateCampusId(campusId);
      const campusExists = await this.campusRepository.exists(campusId);
      if (!campusExists) {
        throw new BadRequestException(`Campus with ID ${campusId} not found`);
      }

      // 3. Check name uniqueness within campus scope
      const existingRole = await this.roleRepository.findByName(
        normalizedName,
        campusId,
      );
      if (existingRole) {
        throw new ConflictException(
          `Role with name "${normalizedName}" already exists in campus ${campusId}`,
        );
      }

      // 4. Prepare role data. ID is intentionally omitted so Prisma stores a
      // database-valid UUID from the schema default.
      const roleData: CreateRoleData = {
        name: normalizedName,
        description: input.description?.trim() || null,
        campusId,
        isSystemDefault: false,
        isSystemRole: false,
        permissionIds: input.permissionIds,
      };

      // 5. Save role and audit atomically.
      const savedRole = await this.unitOfWork.run(async (tx) => {
        const role = await tx.createRole(roleData);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_ROLE",
          targetType: "role",
          targetId: role.id,
          campusId,
          context: buildRoleAuditContext(role, campusId, currentUser),
          afterValue: pickRoleAuditFields(role),
        });

        return role;
      });

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
