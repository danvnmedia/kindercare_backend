import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOccurrence,
} from "@/domain/medication";

export interface MedicationAdministrationDailyParams {
  dueDate: Date;
  classId?: string;
  studentId?: string;
}

export interface MedicationAdministrationHealthCenterSummaryParams {
  dueDate: Date;
  now: Date;
  timeZone: string;
  classId?: string;
}

export interface MedicationAdministrationHealthCenterSummaryCounts {
  dueToday: number;
  overdue: number;
}

export interface MedicationAdministrationHealthCenterDailyParams
  extends MedicationAdministrationHealthCenterSummaryParams {
  offset: number;
  limit: number;
}

export interface MedicationAdministrationClassSummary {
  id: string;
  name: string;
}

export interface MedicationAdministrationQueueRow {
  occurrence: MedicationAdministrationOccurrence;
  request: {
    id: string;
    parentNotes: string | null;
  };
  medicationItem: {
    id: string;
    medicationName: string;
    dosage: string | null;
    instructions: string;
  };
  student: {
    id: string;
    fullName: string;
    studentCode: string | null;
  };
  class: MedicationAdministrationClassSummary | null;
  latestLog: MedicationAdministrationLog | null;
}

export abstract class MedicationAdministrationRepository {
  abstract findDailyByCampus(
    campusId: string,
    params: MedicationAdministrationDailyParams,
  ): Promise<MedicationAdministrationQueueRow[]>;

  abstract countHealthCenterSummaryByCampus(
    campusId: string,
    params: MedicationAdministrationHealthCenterSummaryParams,
  ): Promise<MedicationAdministrationHealthCenterSummaryCounts>;

  abstract findHealthCenterDailyByCampus(
    campusId: string,
    params: MedicationAdministrationHealthCenterDailyParams,
  ): Promise<MedicationAdministrationQueueRow[]>;

  abstract findOccurrenceByIdInCampus(
    campusId: string,
    occurrenceId: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationOccurrence | null>;

  abstract findLogByIdForOccurrence(
    occurrenceId: string,
    logId: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationLog | null>;

  abstract createLog(
    log: MedicationAdministrationLog,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationLog>;

  abstract updateOccurrenceLatestIfExpected(
    occurrence: MedicationAdministrationOccurrence,
    expectedLatestLogId: string | null,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationOccurrence | null>;
}
