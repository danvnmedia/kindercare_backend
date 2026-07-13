import { Injectable } from "@nestjs/common";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { User } from "@/domain/user-management/user.entity";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { HistoricalRecordType } from "../../historical-record-view";
import {
  assertHistoricalRecordFinalized,
  assertRetentionEligible,
  assertRetentionPolicy,
  resolveHistoricalRecord,
} from "./historical-record-workflow";

export interface DeleteHistoricalRecordInput {
  campusId: string;
  recordType: HistoricalRecordType;
  recordId: string;
  reason?: string;
}

@Injectable()
export class DeleteHistoricalRecordUseCase {
  constructor(
    private readonly historicalRecordRepository: HistoricalRecordRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(input: DeleteHistoricalRecordInput, currentUser: User) {
    const resolved = await resolveHistoricalRecord(
      this.historicalRecordRepository,
      input.recordType,
      input.recordId,
      input.campusId,
    );
    assertHistoricalRecordFinalized(resolved);
    const policy = assertRetentionPolicy(
      await this.historicalRecordRepository.findRetentionPolicy(input.campusId),
    );
    assertRetentionEligible(resolved.view, policy, "deletion");

    await this.transactionRunner.run(async (tx) => {
      await this.historicalRecordRepository.deleteRecord(
        input.recordType,
        input.recordId,
        tx,
      );
      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "DELETE_HISTORICAL_RECORD",
          targetType: "student",
          targetId: resolved.studentId,
          campusId: input.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            recordType: input.recordType,
            recordId: input.recordId,
            reason: input.reason ?? null,
            policySource: policy.policySource,
          },
        },
        tx,
      );
    });

    return {
      deleted: true,
      recordType: input.recordType,
      recordId: input.recordId,
    };
  }
}
