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
   * Delete every `user_roles` row whose provenance matches ANY staff-type in
   * the supplied set.
   *
   * Batched into one SQL round-trip via `deleteMany` + `IN (...)` — see
   * D-extra-2 of @doc/specs/staff-multi-type-refactor. Callers (the staff
   * set-diff path in `UpdateStaffUseCase`) compute the `removed` set outside
   * the UoW and pass it here once.
   *
   * Manual grants (`granted_via_staff_type_id IS NULL`) are never matched
   * by SQL semantics — non-null UUIDs in `IN (...)` cannot equal `NULL` —
   * so the D4 "manual rows untouched" invariant of
   * @doc/specs/tracked-grant-revocation is upheld without extra guards.
   *
   * An empty input array is permitted: Prisma compiles `{ in: [] }` to a
   * `false` predicate and returns `count: 0`. The caller-side
   * `if (removed.length > 0)` guard in the spec's set-diff snippet avoids
   * the unnecessary round-trip; this op stays defensive on its own.
   *
   * @returns rows deleted; 0 when no tracked grant matches.
   */
  async revokeRolesByProvenance(
    userId: string,
    grantedViaStaffTypeIds: string[],
  ): Promise<number> {
    const result = await this.tx.userRole.deleteMany({
      where: {
        userId,
        grantedViaStaffTypeId: { in: grantedViaStaffTypeIds },
      },
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
