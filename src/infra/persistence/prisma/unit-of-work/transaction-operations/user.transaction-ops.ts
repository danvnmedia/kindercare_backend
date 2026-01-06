import { PrismaTransactionClient } from "./base.transaction-ops";

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
   * Assign roles to a user within the transaction
   */
  async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    await this.tx.userRole.createMany({
      data: roleIds.map((roleId) => ({
        userId,
        roleId,
      })),
      skipDuplicates: true,
    });
  }
}
