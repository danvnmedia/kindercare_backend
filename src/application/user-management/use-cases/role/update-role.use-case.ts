import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from "@nestjs/common";
import { computeDiff } from "@/application/audit";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Role,
  UpdateRoleData,
  RoleEntity,
} from "../../../../domain/user-management/role.entity";
import { User } from "@/domain/user-management/user.entity";
import { RoleRepository } from "../../ports/role.repository";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";
import { CampusRepository } from "@/application/campus/ports/campus.repository";
import {
  buildRoleAuditContext,
  pickRoleAuditFields,
} from "./role-audit";

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  campusId: string;
}

@Injectable()
export class UpdateRoleUseCase {
  private readonly logger = new Logger(UpdateRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    input: UpdateRoleInput,
    currentUser: User,
  ): Promise<Role> {
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
      if (currentRole.campusId === null) {
        throw new BadRequestException(
          "Global roles cannot be modified via this endpoint",
        );
      }

      // 3. Validate campus ownership from request context.
      RoleEntity.validateCampusId(input.campusId);
      const campusExists = await this.campusRepository.exists(input.campusId);
      if (!campusExists) {
        throw new BadRequestException(
          `Campus with ID ${input.campusId} not found`,
        );
      }
      if (currentRole.campusId !== input.campusId) {
        throw new BadRequestException(
          `Role belongs to campus ${currentRole.campusId}, not ${input.campusId}`,
        );
      }

      // 4. Validate name if provided
      const normalizedName = input.name?.trim();
      if (input.name !== undefined) {
        RoleEntity.validateName(input.name);

        // Check name uniqueness within campus scope (if name changed)
        if (normalizedName !== currentRole.name) {
          const existingRole = await this.roleRepository.findByName(
            normalizedName!,
            currentRole.campusId,
          );
          if (existingRole && existingRole.id !== id) {
            throw new ConflictException(
              `Role with name "${normalizedName}" already exists in campus ${currentRole.campusId}`,
            );
          }
        }
      }

      // 5. Prepare update data
      const updateData: UpdateRoleData = {
      };
      if (normalizedName !== undefined) {
        updateData.name = normalizedName;
      }
      if (input.description !== undefined) {
        updateData.description = input.description.trim() || null;
      }

      const beforeAudit = pickRoleAuditFields(currentRole);
      const requestedAfterAudit = {
        ...(normalizedName !== undefined ? { name: normalizedName } : {}),
        ...(input.description !== undefined
          ? { description: input.description.trim() || null }
          : {}),
      };
      const diff = computeDiff(beforeAudit, requestedAfterAudit);

      if (Object.keys(diff.after).length === 0) {
        this.logger.log(`No role changes detected for ${id}`);
        return currentRole;
      }

      // 6. Update role and audit atomically
      const updatedRole = await this.unitOfWork.run(async (tx) => {
        const role = await tx.updateRole(id, updateData);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_ROLE",
          targetType: "role",
          targetId: role.id,
          campusId: input.campusId,
          context: buildRoleAuditContext(role, input.campusId, currentUser),
          beforeValue: diff.before,
          afterValue: diff.after,
        });

        return role;
      });

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
