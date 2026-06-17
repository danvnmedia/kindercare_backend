import { PrismaTransactionClient } from "./base.transaction-ops";

/**
 * Staff Transaction Operations
 *
 * Provides staff-related database operations within a transaction context.
 */
export class StaffTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  /**
   * Create a new staff within the transaction.
   *
   * Scalar columns only — the staff-type set lives in `staff_staff_type` and
   * is written via `replaceStaffTypes` in the same transaction immediately
   * after this call (see `CreateStaffUseCase`). The legacy `staff_type_id`
   * column was removed by @doc/specs/staff-multi-type-refactor (D5).
   */
  async createStaff(data: {
    id: string;
    campusId: string;
    staffCode: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    address: string | null;
    dateOfBirth: Date | null;
    gender: string | null;
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
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        userId: data.userId,
        isArchived: data.isArchived,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    return { id: staff.id };
  }

  /**
   * Update an existing staff within the transaction.
   *
   * Scalar columns only — the staff-type set lives in `staff_staff_type` and
   * is written via `replaceStaffTypes` in the same transaction. The legacy
   * `staff_type_id` column was removed by
   * @doc/specs/staff-multi-type-refactor (D5).
   */
  async updateStaff(
    id: string,
    data: {
      fullName?: string;
      email?: string;
      phoneNumber?: string;
      address?: string | null;
      dateOfBirth?: Date | null;
      gender?: string | null;
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
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        gender: data.gender,
        userId: data.userId,
        isArchived: data.isArchived,
        updatedAt: data.updatedAt,
      },
    });
    return { id: staff.id };
  }

  /**
   * Replace the full `staff_staff_type` set for a staff inside the active tx.
   *
   * Implementation contract:
   * 1. `deleteMany({ where: { staffId } })` clears every existing join row.
   *    After this point the slate is clean inside the transaction, so the
   *    follow-up `createMany` cannot collide on the composite PK.
   * 2. `createMany` inserts one row per supplied `staffTypeId`. Skipped when
   *    `staffTypeIds` is empty — Prisma rejects `{ data: [] }` on some
   *    client versions, and a no-op insert would be wasted IO regardless.
   *
   * `skipDuplicates` is intentionally NOT set: duplicates in the input array
   * are a caller-contract violation (DTO `@IsUUID('4', { each: true })`
   * does not enforce array-uniqueness today) and should surface as a
   * `P2002` rollback of the surrounding UoW so the bug is visible. The
   * preceding `deleteMany` guarantees no collisions against pre-existing
   * rows.
   *
   * See @doc/specs/staff-multi-type-refactor §Acceptance Criteria AC-10.
   */
  async replaceStaffTypes(
    staffId: string,
    staffTypeIds: string[],
  ): Promise<void> {
    await this.tx.staffStaffType.deleteMany({ where: { staffId } });

    if (staffTypeIds.length > 0) {
      await this.tx.staffStaffType.createMany({
        data: staffTypeIds.map((staffTypeId) => ({ staffId, staffTypeId })),
      });
    }
  }
}
