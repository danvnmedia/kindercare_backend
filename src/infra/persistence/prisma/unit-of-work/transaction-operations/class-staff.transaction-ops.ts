import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { PrismaTransactionClient } from "./base.transaction-ops";

/**
 * Class-Staff Transaction Operations
 *
 * Provides class-staff assignment database operations within a transaction
 * context. Used by `AssignStaffToClassUseCase` (and, in subsequent tasks,
 * by remove + change-role use cases) so the mutation and its audit event
 * commit atomically.
 */
export class ClassStaffTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  /**
   * Create a new class-staff assignment within the transaction.
   *
   * The composite natural key `(classId, staffId)` is the row's identity —
   * see `@doc/specs/subject-removal-classstaff-role-refactor` (D2).
   */
  async createClassStaff(data: {
    classId: string;
    staffId: string;
    role: ClassStaffRole;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ classId: string; staffId: string }> {
    const classStaff = await this.tx.classStaff.create({
      data: {
        classId: data.classId,
        staffId: data.staffId,
        role: data.role,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    return { classId: classStaff.classId, staffId: classStaff.staffId };
  }

  /**
   * Delete a class-staff assignment within the transaction.
   *
   * Targets the row via the composite natural key `(classId, staffId)` —
   * Prisma synthesises the compound `classId_staffId` lookup from the
   * `@@id([classId, staffId])` declaration in the schema.
   */
  async deleteClassStaff(classId: string, staffId: string): Promise<void> {
    await this.tx.classStaff.delete({
      where: { classId_staffId: { classId, staffId } },
    });
  }

  /**
   * Update a class-staff assignment's mutable fields within the transaction.
   *
   * Identity `(classId, staffId)` is immutable; only `role` + `updatedAt` are
   * accepted. Used by `ChangeClassStaffRoleUseCase`.
   */
  async updateClassStaff(
    classId: string,
    staffId: string,
    data: { role: ClassStaffRole; updatedAt: Date },
  ): Promise<{ classId: string; staffId: string }> {
    const updated = await this.tx.classStaff.update({
      where: { classId_staffId: { classId, staffId } },
      data: {
        role: data.role,
        updatedAt: data.updatedAt,
      },
    });
    return { classId: updated.classId, staffId: updated.staffId };
  }
}
