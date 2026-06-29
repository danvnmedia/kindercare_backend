import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";
import { RoleRepository } from "../../ports/role.repository";
import { UserRepository } from "../../ports/user.repository";

export interface RemoveUsersFromRoleInput {
  roleId: string;
  userIds: string[];
  campusId: string;
}

// Audit `context` shape for REVOKE_ROLE — per-pair granularity per D1 of
// @doc/specs/direct-role-assignment-via-uow. One audit row per
// (userId, roleId, campusId) tuple that actually deletes; D4 suppresses the
// no-op case (deleted=0). Mirrors `GrantRoleContext` for symmetry — same
// shape on both sides keeps the audit-log doc and downstream readers simple.
// The index signature flows this typed shape into the port's wider
// `Record<string, unknown>` jsonb contract without an `as` cast at the
// call site.
interface RevokeRoleContext {
  roleId: string;
  campusId: string;
  actorName: string | null;
  [key: string]: unknown;
}

@Injectable()
export class RemoveUsersFromRoleUseCase {
  private readonly logger = new Logger(RemoveUsersFromRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: RemoveUsersFromRoleInput,
    currentUser: User,
  ): Promise<void> {
    this.logger.log(
      `Revoking role ${input.roleId} from ${new Set(input.userIds).size} user(s) in campus ${input.campusId}`,
    );

    const uniqueUserIds = [...new Set(input.userIds)];

    // Phase 1: pre-validation OUTSIDE the UoW. First failure aborts before
    // any user_roles row is deleted and before any audit event is emitted.
    // Symmetric to AssignUsersToRoleUseCase.
    const role = await this.roleRepository.findById(input.roleId);
    if (!role) {
      throw new NotFoundException(`Role ${input.roleId} not found`);
    }
    if (role.campusId === null) {
      // D3: system roles are seed/migration only — revoking them via the
      // public endpoint is out of scope.
      throw new BadRequestException(
        "Cannot revoke system roles via this endpoint",
      );
    }
    if (role.campusId !== input.campusId) {
      throw new BadRequestException(
        `Role belongs to campus ${role.campusId}, not ${input.campusId}`,
      );
    }
    for (const userId of uniqueUserIds) {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
    }

    // Phase 2: transactional deletes + audits in one closure. If any
    // `tx.revokeRoles` or `tx.recordAudit` throws, Prisma rolls back the
    // entire batch — no partial revokes, no orphan audit rows.
    //
    // Note on Scenario 9 (admin-override): `tx.revokeRoles` deletes by exact
    // `(userId, roleId, campusId)` regardless of `granted_via_staff_type_id`,
    // so manual revoke removes tracked-provenance rows too. This is intentional
    // and symmetric to D5 manual-wins on the grant side.
    await this.unitOfWork.run(async (tx) => {
      for (const userId of uniqueUserIds) {
        const deleted = await tx.revokeRoles(userId, [
          {
            roleId: input.roleId,
            campusId: input.campusId,
          },
        ]);

        if (deleted > 0) {
          // D4: audit only on actual state change. deleted=0 means the user
          // never held this role-campus pair — idempotent no-op, no row in
          // the audit log.
          const context: RevokeRoleContext = {
            roleId: input.roleId,
            campusId: input.campusId,
            actorName: currentUser.profile?.fullName ?? null,
          };
          await tx.recordAudit({
            actorId: currentUser.id,
            action: "REVOKE_ROLE",
            targetType: "user",
            targetId: userId,
            campusId: input.campusId,
            context,
          });
          this.logger.log(
            `Revoked role ${input.roleId} from user ${userId} in campus ${input.campusId}`,
          );
        } else {
          this.logger.log(
            `Revoke skipped — user ${userId} did not hold (role ${input.roleId}, campus ${input.campusId})`,
          );
        }
      }
    });
  }
}
