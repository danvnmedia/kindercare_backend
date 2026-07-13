import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import {
  HistoricalCorrectionPatch,
  HistoricalRecordType,
} from "../historical-record-view";

export interface HistoricalRecordCorrectionEvent {
  id: string;
  campusId: string;
  recordType: HistoricalRecordType;
  recordId: string;
  actorId: string;
  reason: string;
  beforeValue: HistoricalCorrectionPatch;
  afterValue: HistoricalCorrectionPatch;
  createdAt: Date;
}

export interface HistoricalRetentionPolicy {
  id: string;
  campusId: string | null;
  environment: string | null;
  policySource: string;
  retentionDays: number;
  deletionAllowed: boolean;
  redactionAllowed: boolean;
  isActive: boolean;
}

export interface HistoricalRecordWriteState {
  archivedAt?: Date | null;
  redactedAt?: Date | null;
  retentionExpiresAt?: Date | null;
  retentionPolicySource?: string | null;
}

export abstract class HistoricalRecordRepository {
  abstract findEnrollmentByIdInCampus(
    id: string,
    campusId: string,
  ): Promise<Enrollment | null>;

  abstract findSchoolYearEnrollmentByIdInCampus(
    id: string,
    campusId: string,
  ): Promise<SchoolYearEnrollment | null>;

  abstract findCorrections(
    recordType: HistoricalRecordType,
    recordId: string,
  ): Promise<HistoricalRecordCorrectionEvent[]>;

  abstract appendCorrection(
    event: Omit<HistoricalRecordCorrectionEvent, "id" | "createdAt">,
    tx?: AppTransactionClient,
  ): Promise<HistoricalRecordCorrectionEvent>;

  abstract findRetentionPolicy(
    campusId: string,
    environment?: string | null,
  ): Promise<HistoricalRetentionPolicy | null>;

  abstract archiveRecord(
    recordType: HistoricalRecordType,
    recordId: string,
    state: HistoricalRecordWriteState,
    tx?: AppTransactionClient,
  ): Promise<void>;

  abstract redactRecord(
    recordType: HistoricalRecordType,
    recordId: string,
    state: HistoricalRecordWriteState,
    tx?: AppTransactionClient,
  ): Promise<void>;

  abstract deleteRecord(
    recordType: HistoricalRecordType,
    recordId: string,
    tx?: AppTransactionClient,
  ): Promise<void>;
}
