import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { RoleEntity } from "../../../../domain/user-management/role.entity";
import { RoleRepository } from "../../ports/role.repository";
import { RoleNotFoundException } from "../../../../domain/user-management/exceptions/role-not-found.exception";
import {
  buildRoleAuditContext,
  pickRoleAuditFields,
} from "./role-audit";

export interface DeleteRoleInput {
  campusId: string;
}

@Injectable()
export class DeleteRoleUseCase {
  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    input: DeleteRoleInput,
    currentUser: User,
  ): Promise<void> {
    try {
      // 1. Find existing role
      const role = await this.roleRepository.findById(id);
      if (!role) {
        throw new RoleNotFoundException(id);
      }

      // 2. Check if role is system default or system role (cannot be deleted)
      if (role.isSystemDefault) {
        throw new BadRequestException("System default roles cannot be deleted");
      }
      if (role.isSystemRole) {
        throw new BadRequestException("System roles cannot be deleted via API");
      }
      if (role.campusId === null) {
        throw new BadRequestException(
          "Global roles cannot be deleted via this endpoint",
        );
      }

      // 3. Validate campus ownership from request context.
      RoleEntity.validateCampusId(input.campusId);
      if (role.campusId !== input.campusId) {
        throw new BadRequestException(
          `Role belongs to campus ${role.campusId}, not ${input.campusId}`,
        );
      }

      // 4. Delete role and audit atomically.
      const beforeAudit = pickRoleAuditFields(role);
      await this.unitOfWork.run(async (tx) => {
        await tx.deleteRole(id);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "DELETE_ROLE",
          targetType: "role",
          targetId: id,
          campusId: input.campusId,
          context: buildRoleAuditContext(role, input.campusId, currentUser),
          beforeValue: beforeAudit,
        });
      });
    } catch (error) {
      if (error instanceof RoleNotFoundException) {
        throw new NotFoundException(error.message);
      }
      throw error;
    }
  }
}
