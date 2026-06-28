import { Prisma } from "@prisma/client";

/**
 * Type alias for Prisma interactive transaction client
 * Used by all transaction operation classes
 */
export type PrismaTransactionClient = Prisma.TransactionClient;
