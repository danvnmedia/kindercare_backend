import { ForbiddenException, Injectable } from "@nestjs/common";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { hasAnyPermissionInCampus } from "@/application/rbac/permission-access";
import { User } from "@/domain/user-management/user.entity";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { HistoricalRecordType } from "../../historical-record-view";
import { resolveHistoricalRecord } from "./historical-record-workflow";

const HISTORICAL_RECORD_EXPORT_PERMISSION = "historical_records.export";

export interface ExportHistoricalRecordInput {
  campusId: string;
  recordType: HistoricalRecordType;
  recordId: string;
}

@Injectable()
export class ExportHistoricalRecordUseCase {
  constructor(
    private readonly historicalRecordRepository: HistoricalRecordRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(input: ExportHistoricalRecordInput, currentUser: User) {
    const resolved = await resolveHistoricalRecord(
      this.historicalRecordRepository,
      input.recordType,
      input.recordId,
      input.campusId,
    );

    if (
      !hasAnyPermissionInCampus(currentUser, input.campusId, [
        HISTORICAL_RECORD_EXPORT_PERMISSION,
      ])
    ) {
      await this.recordExportAttempt(input, currentUser, resolved.studentId, {
        outcome: "denied",
        reason: "missing_permission",
      });
      throw new ForbiddenException(
        "HISTORICAL_RECORD_EXPORT_PERMISSION_REQUIRED",
      );
    }

    await this.recordExportAttempt(input, currentUser, resolved.studentId, {
      outcome: "success",
    });

    return resolved;
  }

  private async recordExportAttempt(
    input: ExportHistoricalRecordInput,
    currentUser: User,
    studentId: string,
    context: { outcome: "success" | "denied"; reason?: string },
  ): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "EXPORT_HISTORICAL_RECORD",
          targetType: "student",
          targetId: studentId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            recordType: input.recordType,
            recordId: input.recordId,
            outcome: context.outcome,
            reason: context.reason ?? null,
          },
        },
        tx,
      );
    });
  }
}
