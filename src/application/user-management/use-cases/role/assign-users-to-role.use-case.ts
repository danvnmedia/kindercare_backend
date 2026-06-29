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

export interface AssignUsersToRoleInput {
  roleId: string;
  userIds: string[];
  campusId: string;
}

// Audit `context` shape for GRANT_ROLE — per-pair granularity per D1 of
// @doc/specs/direct-role-assignment-via-uow. One audit row per
// (userId, roleId, campusId) tuple; N users in the batch produce N rows.
// The index signature flows this typed shape into the port's wider
// `Record<string, unknown>` jsonb contract without an `as` cast at the
// call site — same pattern as EditStaffProfileContext.
interface GrantRoleContext {
  roleId: string;
  campusId: string;
  actorName: string | null;
  [key: string]: unknown;
}

@Injectable()
export class AssignUsersToRoleUseCase {
  private readonly logger = new Logger(AssignUsersToRoleUseCase.name);

  constructor(
    @Inject("ROLE_REPOSITORY")
    private readonly roleRepository: RoleRepository,
    @Inject("USER_REPOSITORY")
    private readonly userRepository: UserRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: AssignUsersToRoleInput,
    currentUser: User,
  ): Promise<void> {
    this.logger.log(
      `Granting role ${input.roleId} to ${new Set(input.userIds).size} user(s) in campus ${input.campusId}`,
    );

    const uniqueUserIds = [...new Set(input.userIds)];

    // Phase 1: pre-validation OUTSIDE the UoW. First failure aborts before
    // any user_roles row is written and before any audit event is emitted.
    const role = await this.roleRepository.findById(input.roleId);
    if (!role) {
      throw new NotFoundException(`Role ${input.roleId} not found`);
    }
    if (role.campusId === null) {
      // D3: system roles are seed/migration only — granting them via the
      // public endpoint is out of scope (separate privileged path, if ever).
      throw new BadRequestException(
        "Cannot grant system roles via this endpoint",
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

    // Phase 2: transactional writes + audits in one closure. If `tx.assignRoles`
    // or `tx.recordAudit` throws on any user, Prisma rolls back the entire
    // batch (D5 all-or-none) — no partial grants, no orphan audit rows.
    await this.unitOfWork.run(async (tx) => {
      for (const userId of uniqueUserIds) {
        const inserted = await tx.assignRoles(userId, [
          {
            roleId: input.roleId,
            campusId: input.campusId,
            grantedViaStaffTypeId: null,
          },
        ]);

        if (inserted > 0) {
          // D4: audit only on actual state change. inserted=0 means a
          // pre-existing row already holds the (userId, roleId, campusId)
          // tuple (D5 manual-wins / tracked-wins) — the audit log mirrors
          // real changes, not admin intent.
          const context: GrantRoleContext = {
            roleId: input.roleId,
            campusId: input.campusId,
            actorName: currentUser.profile?.fullName ?? null,
          };
          await tx.recordAudit({
            actorId: currentUser.id,
            action: "GRANT_ROLE",
            targetType: "user",
            targetId: userId,
            campusId: input.campusId,
            context,
          });
          this.logger.log(
            `Granted role ${input.roleId} to user ${userId} in campus ${input.campusId}`,
          );
        } else {
          this.logger.log(
            `Grant skipped — row already holds (user ${userId}, role ${input.roleId}, campus ${input.campusId})`,
          );
        }
      }
    });
  }
}
