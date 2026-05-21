import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaUnitOfWork } from "./unit-of-work/prisma-unit-of-work";
import { PrismaTransactionRunner } from "./transaction-runner";
import { PrismaAuditEventRecorder } from "./audit-event-recorder";
import { PrismaAuditEventRepository } from "./repositories/prisma-audit-event.repository";

@Module({
  imports: [StandardResponseModule],
  providers: [
    PrismaService,
    {
      provide: UnitOfWorkPort,
      useClass: PrismaUnitOfWork,
    },
    {
      provide: TransactionRunnerPort,
      useClass: PrismaTransactionRunner,
    },
    {
      provide: AuditEventRecorderPort,
      useClass: PrismaAuditEventRecorder,
    },
    {
      provide: AuditEventRepository,
      useClass: PrismaAuditEventRepository,
    },
  ],
  exports: [
    PrismaService,
    UnitOfWorkPort,
    TransactionRunnerPort,
    AuditEventRecorderPort,
    AuditEventRepository,
  ],
})
export class PrismaModule {}
