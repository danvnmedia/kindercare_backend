import { PrismaTransactionClient } from "./base.transaction-ops";

/**
 * Guardian Transaction Operations
 *
 * Provides guardian-related database operations within a transaction context.
 */
export class GuardianTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  /**
   * Create a new guardian within the transaction
   */
  async createGuardian(data: {
    id: string;
    campusId: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    address: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    occupation: string | null;
    workAddress: string | null;
    userId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }> {
    const guardian = await this.tx.guardian.create({
      data: {
        id: data.id,
        campusId: data.campusId,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        occupation: data.occupation,
        workAddress: data.workAddress,
        userId: data.userId,
        isArchived: data.isArchived,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    return { id: guardian.id };
  }

  /**
   * Update an existing guardian within the transaction
   */
  async updateGuardian(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      address?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      occupation?: string | null;
      workAddress?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }> {
    const guardian = await this.tx.guardian.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        occupation: data.occupation,
        workAddress: data.workAddress,
        isArchived: data.isArchived,
        updatedAt: data.updatedAt,
      },
    });
    return { id: guardian.id };
  }
}
