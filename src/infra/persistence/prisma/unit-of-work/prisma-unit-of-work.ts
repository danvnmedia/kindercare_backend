import { Injectable } from "@nestjs/common";
import {
  TransactionContext,
  UnitOfWorkPort,
} from "@/application/ports/unit-of-work.port";
import { PrismaService } from "../prisma.service";
import { Prisma } from "@prisma/client";

/**
 * Prisma implementation of Unit of Work
 *
 * Wraps operations in a Prisma interactive transaction,
 * ensuring all operations succeed or all fail together.
 */
@Injectable()
export class PrismaUnitOfWork extends UnitOfWorkPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Execute a task within a Prisma transaction
   */
  async run<T>(task: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (prismaTransaction) => {
      // Create transaction context that wraps Prisma transaction client
      const transactionContext = this.createTransactionContext(prismaTransaction);
      return task(transactionContext);
    });
  }

  /**
   * Create a TransactionContext from Prisma transaction client
   */
  private createTransactionContext(
    tx: Prisma.TransactionClient,
  ): TransactionContext {
    return {
      createUser: async (data) => {
        const user = await tx.user.create({
          data: {
            clerkUid: data.clerkUid,
            isActive: data.isActive,
          },
        });
        return { id: user.id, clerkUid: user.clerkUid };
      },

      createGuardian: async (data) => {
        const guardian = await tx.guardian.create({
          data: {
            id: data.id,
            fullName: data.fullName,
            email: data.email,
            phoneNumber: data.phoneNumber,
            address: data.address,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender,
            occupation: data.occupation,
            workAddress: data.workAddress,
            spouseId: data.spouseId,
            userId: data.userId,
            isArchived: data.isArchived,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        });
        return { id: guardian.id };
      },

      updateGuardian: async (id, data) => {
        const guardian = await tx.guardian.update({
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
      },
    };
  }
}
