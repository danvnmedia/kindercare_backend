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
   * Assign roles to a user within the transaction with campus context
   *
   * @param userId - The user to assign roles to
   * @param roleAssignments - Array of role assignments with optional campusId
   */
  async assignRoles(
    userId: string,
    roleAssignments: RoleAssignmentInput[],
  ): Promise<void> {
    await this.tx.userRole.createMany({
      data: roleAssignments.map((assignment) => ({
        userId,
        roleId: assignment.roleId,
        campusId: assignment.campusId ?? null, // null for global assignment
      })),
      skipDuplicates: true,
    });
  }
}
