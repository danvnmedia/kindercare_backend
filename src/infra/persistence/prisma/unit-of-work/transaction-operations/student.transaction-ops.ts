import { PrismaTransactionClient } from "./base.transaction-ops";

/**
 * Student Transaction Operations
 *
 * Provides student-related database operations within a transaction context.
 *
 * Immutable fields (`studentCode`, `campusId`, `createdAt`) are deliberately
 * excluded from `updateStudent` per the four-layer immutability rule
 * (@doc/guides/code-generation-pattern#immutability).
 */
export class StudentTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  /**
   * Create a new student within the transaction
   */
  async createStudent(data: {
    id: string;
    campusId: string;
    studentCode: string;
    fullName: string;
    email: string | null;
    phoneNumber: string | null;
    address: string | null;
    dateOfBirth: Date | null;
    nickname: string | null;
    gender: string | null;
    isArchived: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<{ id: string }> {
    const student = await this.tx.student.create({
      data: {
        id: data.id,
        campusId: data.campusId,
        studentCode: data.studentCode,
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        nickname: data.nickname,
        gender: data.gender,
        isArchived: data.isArchived,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
    return { id: student.id };
  }

  /**
   * Update an existing student within the transaction
   */
  async updateStudent(
    id: string,
    data: {
      fullName?: string;
      email?: string | null;
      phoneNumber?: string | null;
      address?: string | null;
      dateOfBirth?: Date | null;
      nickname?: string | null;
      gender?: string | null;
      isArchived?: boolean;
      updatedAt?: Date;
    },
  ): Promise<{ id: string }> {
    const student = await this.tx.student.update({
      where: { id },
      data: {
        fullName: data.fullName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        address: data.address,
        dateOfBirth: data.dateOfBirth,
        nickname: data.nickname,
        gender: data.gender,
        isArchived: data.isArchived,
        updatedAt: data.updatedAt,
      },
    });
    return { id: student.id };
  }

  /**
   * Assign guardians to a student within the transaction.
   *
   * Mirrors `StudentRepository.assignGuardians`; uses `skipDuplicates: true`
   * so concurrent link attempts on the same (studentId, guardianId) pair are
   * idempotent at the persistence layer. Application-layer uniqueness checks
   * still enforce ConflictException for the user-visible contract.
   */
  async assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void> {
    await this.tx.guardianStudent.createMany({
      data: guardianRelations.map((relation) => ({
        studentId,
        guardianId: relation.guardianId,
        guardianRelationshipId: relation.relationshipId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Remove guardians from a student within the transaction.
   *
   * Mirrors `StudentRepository.removeGuardians`. Callers MUST pre-resolve any
   * snapshot data (e.g. `relationshipType` for audit context) BEFORE invoking
   * this op — the row is gone by the time the surrounding `tx.recordAudit`
   * runs.
   */
  async removeGuardians(
    studentId: string,
    guardianIds: string[],
  ): Promise<void> {
    await this.tx.guardianStudent.deleteMany({
      where: {
        studentId,
        guardianId: { in: guardianIds },
      },
    });
  }
}
