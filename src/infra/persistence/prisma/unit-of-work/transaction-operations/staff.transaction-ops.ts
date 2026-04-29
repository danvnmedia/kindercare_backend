import { PrismaTransactionClient } from "./base.transaction-ops";

/**
 * Staff Transaction Operations
 *
 * Provides staff-related database operations within a transaction context.
 */
export class StaffTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  /**
   * Create a new staff within the transaction
   */
  async createStaff(data: {
    id: string;
    campusId: string;
    staffCode: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    staffTypeId: string | null;
    address: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
    startDate: Date | null;
    userId: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }> {
    const staff = await this.tx.staff.create({
      data: {
        id: data.id,
        campusId: data.campusId,
        staffCode: data.staffCode,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        staffTypeId: data.staffTypeId,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        startDate: data.startDate,
        userId: data.userId,
        isArchived: data.isArchived,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    return { id: staff.id };
  }

  /**
   * Update an existing staff within the transaction
   */
  async updateStaff(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      staffTypeId?: string | null;
      address?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
      startDate?: Date | null;
      userId?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }> {
    const staff = await this.tx.staff.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        staffTypeId: data.staffTypeId,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        startDate: data.startDate,
        userId: data.userId,
        isArchived: data.isArchived,
        updatedAt: data.updatedAt,
      },
    });
    return { id: staff.id };
  }
}
