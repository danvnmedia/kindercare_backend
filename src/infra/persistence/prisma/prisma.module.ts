import { Module } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { HistoricalRecordRepository } from "@/application/class-management/ports/historical-record.repository";
import { StudentHardDeleteGuardPort } from "@/application/user-management/ports/student-hard-delete-guard.port";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaUnitOfWork } from "./unit-of-work/prisma-unit-of-work";
import { PrismaTransactionRunner } from "./transaction-runner";
import { PrismaAuditEventRecorder } from "./audit-event-recorder";
import { PrismaAuditEventRepository } from "./repositories/prisma-audit-event.repository";
import { PrismaHistoricalRecordRepository } from "./repositories/prisma-historical-record.repository";

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
    // Cross-cutting historical record persistence is shared by class-management
    // history APIs and user-management deletion guards. Keep feature use cases
    // depending on their own ports; alias both ports to the same Prisma adapter.
    {
      provide: HistoricalRecordRepository,
      useClass: PrismaHistoricalRecordRepository,
    },
    {
      provide: StudentHardDeleteGuardPort,
      useExisting: HistoricalRecordRepository,
    },
  ],
  exports: [
    PrismaService,
    UnitOfWorkPort,
    TransactionRunnerPort,
    AuditEventRecorderPort,
    AuditEventRepository,
    HistoricalRecordRepository,
    StudentHardDeleteGuardPort,
  ],
})
export class PrismaModule {}
