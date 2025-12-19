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
}
