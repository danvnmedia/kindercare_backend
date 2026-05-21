import { Injectable } from "@nestjs/common";

import {
  AppTransactionClient,
  TransactionRunnerPort,
} from "@/application/ports/transaction-runner.port";

import { PrismaService } from "./prisma.service";

/**
 * PrismaTransactionRunner — infra adapter for `TransactionRunnerPort`.
 *
 * Thin pass-through to `PrismaService.$transaction`. The closure's argument is
 * the same `Prisma.TransactionClient` that `AuditEventRecorderPort.record`
 * accepts, so an audit emit issued inside this tx participates in the caller's
 * transaction by construction (no convention required) — see
 * @doc/specs/admin-audit-log Locked Decision D4.
 */
@Injectable()
export class PrismaTransactionRunner extends TransactionRunnerPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async run<T>(task: (tx: AppTransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction((tx) => task(tx));
  }
}
