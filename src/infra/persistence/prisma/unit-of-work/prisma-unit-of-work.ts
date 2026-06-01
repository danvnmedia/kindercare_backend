import { Injectable } from "@nestjs/common";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { PrismaService } from "../prisma.service";
import {
  PrismaTransactionClient,
  UserTransactionOps,
  GuardianTransactionOps,
  StaffTransactionOps,
  StudentTransactionOps,
  ClassStaffTransactionOps,
  MealMenuTransactionOps,
} from "./transaction-operations";

/**
 * Prisma implementation of Unit of Work
 *
 * Wraps operations in a Prisma interactive transaction,
 * ensuring all operations succeed or all fail together.
 *
 * Uses modular transaction operation classes for maintainability.
 * Each domain has its own *TransactionOps class that handles
 * its specific database operations within the transaction.
 */
@Injectable()
export class PrismaUnitOfWork extends UnitOfWorkPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditRecorder: AuditEventRecorderPort,
  ) {
    super();
  }

  /**
   * Execute a task within a Prisma transaction
   */
  async run<T>(task: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (prismaTransaction) => {
      const transactionContext =
        this.createTransactionContext(prismaTransaction);
      return task(transactionContext);
    });
  }

  /**
   * Create a TransactionContext by composing domain-specific transaction operations
   *
   * Each domain's operations are encapsulated in their own class,
   * making it easy to add new domains without modifying this file significantly.
   */
  private createTransactionContext(
    tx: PrismaTransactionClient,
  ): TransactionContext {
    const userOps = new UserTransactionOps(tx);
    const guardianOps = new GuardianTransactionOps(tx);
    const staffOps = new StaffTransactionOps(tx);
    const studentOps = new StudentTransactionOps(tx);
    const classStaffOps = new ClassStaffTransactionOps(tx);
    const mealMenuOps = new MealMenuTransactionOps(tx);

    return {
      // User operations
      createUser: userOps.createUser.bind(userOps),
      updateUser: userOps.updateUser.bind(userOps),
      assignRoles: userOps.assignRoles.bind(userOps),
      revokeRolesByProvenance: userOps.revokeRolesByProvenance.bind(userOps),
      revokeRoles: userOps.revokeRoles.bind(userOps),

      // Guardian operations
      createGuardian: guardianOps.createGuardian.bind(guardianOps),
      updateGuardian: guardianOps.updateGuardian.bind(guardianOps),

      // Staff operations
      createStaff: staffOps.createStaff.bind(staffOps),
      updateStaff: staffOps.updateStaff.bind(staffOps),
      replaceStaffTypes: staffOps.replaceStaffTypes.bind(staffOps),

      // Student operations
      createStudent: studentOps.createStudent.bind(studentOps),
      updateStudent: studentOps.updateStudent.bind(studentOps),
      assignGuardians: studentOps.assignGuardians.bind(studentOps),
      removeGuardians: studentOps.removeGuardians.bind(studentOps),

      // Class-staff operations
      createClassStaff: classStaffOps.createClassStaff.bind(classStaffOps),
      deleteClassStaff: classStaffOps.deleteClassStaff.bind(classStaffOps),
      updateClassStaff: classStaffOps.updateClassStaff.bind(classStaffOps),

      // Meal-menu operations
      createMealMenu: mealMenuOps.createMealMenu.bind(mealMenuOps),
      updateMealMenu: mealMenuOps.updateMealMenu.bind(mealMenuOps),
      archiveMealMenu: mealMenuOps.archiveMealMenu.bind(mealMenuOps),
      restoreMealMenu: mealMenuOps.restoreMealMenu.bind(mealMenuOps),
      upsertMealMenuConfig: mealMenuOps.upsertMealMenuConfig.bind(mealMenuOps),

      // Audit operations — captures the active `prismaTransaction` so callers
      // never have to thread a raw `Prisma.TransactionClient` themselves.
      // Guarantees same-tx atomicity by construction (D4 of
      // `@doc/specs/admin-audit-log`).
      recordAudit: (input) => this.auditRecorder.record(input, tx),
    };
  }
}
