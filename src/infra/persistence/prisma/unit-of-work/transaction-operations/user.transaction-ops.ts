import { PrismaTransactionClient } from "./base.transaction-ops";
import { RoleAssignmentInput } from "@/application/user-management/ports/user.repository";

/**
 * User Transaction Operations
 *
 * Provides user-related database operations within a transaction context.
 */
export class UserTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  /**
   * Create a new user within the transaction
   */
  async createUser(data: {
    clerkUid: string;
    isActive: boolean;
  }): Promise<{ id: string; clerkUid: string }> {
    const user = await this.tx.user.create({
      data: {
        clerkUid: data.clerkUid,
        isActive: data.isActive,
      },
    });
    return { id: user.id, clerkUid: user.clerkUid };
  }

  /**
   * Update an existing user within the transaction
   */
  async updateUser(
    id: string,
    data: {
      isActive?: boolean;
    },
  ): Promise<{ id: string }> {
    const user = await this.tx.user.update({
      where: { id },
      data: {
        isActive: data.isActive,
      },
    });
    return { id: user.id };
  }

  /**
   * Assign roles to a user within the transaction with campus + provenance context.
   *
   * `skipDuplicates: true` compiles to `ON CONFLICT DO NOTHING` on PostgreSQL —
   * a colliding `(userId, roleId, campusId)` row is preserved unchanged and
   * NOT counted in the returned `count`. This is the SQL-level expression of
   * the D5 manual-wins policy (see @doc/specs/tracked-grant-revocation).
   *
   * @returns rows actually inserted; 0 when every input collided.
   */
  async assignRoles(
    userId: string,
    roleAssignments: Array<
      RoleAssignmentInput & { grantedViaStaffTypeId?: string | null }
    >,
  ): Promise<number> {
    const result = await this.tx.userRole.createMany({
      data: roleAssignments.map((assignment) => ({
        userId,
        roleId: assignment.roleId,
        campusId: assignment.campusId ?? null,
        grantedViaStaffTypeId: assignment.grantedViaStaffTypeId ?? null,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Delete every `user_roles` row whose provenance matches the given staff-type.
   *
   * Manual grants (`granted_via_staff_type_id IS NULL`) are never matched —
   * a `string` parameter cannot equal `NULL` in SQL — so the D4 "manual rows
   * untouched" invariant is upheld by SQL semantics, not by extra guards.
   *
   * @returns rows deleted (0 when no tracked grant exists for this pair).
   */
  async revokeRolesByProvenance(
    userId: string,
    grantedViaStaffTypeId: string,
  ): Promise<number> {
    const result = await this.tx.userRole.deleteMany({
      where: { userId, grantedViaStaffTypeId },
    });
    return result.count;
  }

  /**
   * Delete `user_roles` rows whose natural key `(userId, roleId, campusId)`
   * matches any of the supplied tuples, regardless of provenance.
   *
   * The `OR` over `(roleId, campusId)` pairs is provenance-blind by SQL
   * construction — no `grantedViaStaffTypeId` clause means both manual
   * (NULL provenance) and tracked (non-NULL provenance) rows whose natural
   * key matches are deleted. That's the Scenario 9 lockdown of
   * @doc/specs/direct-role-assignment-via-uow, in contrast to
   * `revokeRolesByProvenance` which deliberately filters by provenance.
   *
   * @returns rows deleted; 0 when no supplied pair matches (idempotent).
   */
  async revokeRoles(
    userId: string,
    removals: Array<{ roleId: string; campusId: string | null }>,
  ): Promise<number> {
    const result = await this.tx.userRole.deleteMany({
      where: {
        userId,
        OR: removals.map((removal) => ({
          roleId: removal.roleId,
          campusId: removal.campusId,
        })),
      },
    });
    return result.count;
  }
}
