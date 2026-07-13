import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { AuditEventRecorderPort } from "@/application/audit/ports/audit-event-recorder.port";
import { TransactionRunnerPort } from "@/application/ports/transaction-runner.port";
import { User } from "@/domain/user-management/user.entity";
import { HistoricalRecordRepository } from "../../ports/historical-record.repository";
import { HistoricalRecordType } from "../../historical-record-view";
import {
  flattenEffectiveSnapshot,
  normalizeCorrectionPatch,
  resolveHistoricalRecord,
} from "./historical-record-workflow";

export interface CorrectHistoricalRecordInput {
  campusId: string;
  recordType: HistoricalRecordType;
  recordId: string;
  reason: string;
  afterValue: Record<string, unknown>;
}

@Injectable()
export class CorrectHistoricalRecordUseCase {
  constructor(
    private readonly historicalRecordRepository: HistoricalRecordRepository,
    private readonly transactionRunner: TransactionRunnerPort,
    private readonly recorder: AuditEventRecorderPort,
  ) {}

  async execute(input: CorrectHistoricalRecordInput, currentUser: User) {
    const reason = input.reason?.trim();
    if (!reason) {
      throw new BadRequestException("CORRECTION_REASON_REQUIRED");
    }

    const resolved = await resolveHistoricalRecord(
      this.historicalRecordRepository,
      input.recordType,
      input.recordId,
      input.campusId,
    );
    if (!resolved.finalized) {
      throw new ConflictException("HISTORICAL_RECORD_NOT_FINALIZED");
    }

    const afterValue = normalizeCorrectionPatch(
      input.recordType,
      input.afterValue,
    );
    const beforeValue = flattenEffectiveSnapshot(resolved.view);

    await this.transactionRunner.run(async (tx) => {
      await this.historicalRecordRepository.appendCorrection(
        {
          campusId: input.campusId,
          recordType: input.recordType,
          recordId: input.recordId,
          actorId: currentUser.id,
          reason,
          beforeValue,
          afterValue,
        },
        tx,
      );

      await this.recorder.record(
        {
          actorId: currentUser.id,
          action: "CORRECT_HISTORICAL_RECORD",
          targetType: "student",
          targetId: resolved.studentId,
          campusId: input.campusId,
          beforeValue,
          afterValue,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            recordType: input.recordType,
            recordId: input.recordId,
            reason,
          },
        },
        tx,
      );
    });

    return resolveHistoricalRecord(
      this.historicalRecordRepository,
      input.recordType,
      input.recordId,
      input.campusId,
    );
  }
}
