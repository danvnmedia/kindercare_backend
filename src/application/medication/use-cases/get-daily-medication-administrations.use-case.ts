import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { CampusRepository } from "@/application/campus/ports/campus.repository";

import { getCampusDateString } from "@/core/time/campus-time-zone";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOutcome,
  MedicationAdministrationOccurrence,
  MedicationAdministrationStatus,
  normalizeDateOnly,
} from "@/domain/medication";

import { getMedicationOccurrenceDueAt } from "../medication-time-boundaries";
import {
  MedicationAdministrationQueueRow,
  MedicationAdministrationRepository,
} from "../ports";

export interface GetDailyMedicationAdministrationsInput {
  date?: string;
  classId?: string;
  studentId?: string;
  status?: MedicationAdministrationStatus;
}

export interface MedicationAdministrationLogSummary {
  id: string;
  outcome: MedicationAdministrationOutcome;
  recordedByUserId: string;
  recordedAt: Date;
  actualTime: string | null;
  note: string | null;
  correctionOfLogId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MedicationAdministrationQueueItem {
  occurrenceId: string;
  requestId: string;
  medicationItemId: string;
  student: {
    id: string;
    fullName: string;
    studentCode: string | null;
  };
  class: {
    id: string;
    name: string;
  } | null;
  medicationName: string;
  dosage: string | null;
  instructions: string;
  dueDate: Date;
  dueTime: string;
  status: MedicationAdministrationStatus;
  isOverdue: boolean;
  parentNotes: string | null;
  latestLog: MedicationAdministrationLogSummary | null;
  latestOutcome: MedicationAdministrationOutcome | null;
  latestLogId: string | null;
  latestRecordedAt: Date | null;
  latestRecordedByUserId: string | null;
  latestNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class GetDailyMedicationAdministrationsUseCase {
  constructor(
    @Inject("MEDICATION_ADMINISTRATION_REPOSITORY")
    private readonly medicationAdministrationRepository: MedicationAdministrationRepository,
    @Inject("CAMPUS_REPOSITORY")
    private readonly campusRepository: CampusRepository,
  ) {}

  async execute(
    campusId: string,
    input: GetDailyMedicationAdministrationsInput,
    now = new Date(),
  ): Promise<MedicationAdministrationQueueItem[]> {
    const campus = await this.campusRepository.findById(campusId);
    if (!campus) {
      throw new NotFoundException("Campus not found");
    }

    const dueDate = this.normalizeQueueDate(input.date, now, campus.timeZone);
    const rows =
      await this.medicationAdministrationRepository.findDailyByCampus(
        campusId,
        {
          dueDate,
          classId: input.classId,
          studentId: input.studentId,
        },
      );

    return rows
      .sort(compareQueueRows)
      .map((row) => mapQueueRowToItem(row, now, campus.timeZone))
      .filter((item) => !input.status || item.status === input.status);
  }

  private normalizeQueueDate(
    value: string | undefined,
    now: Date,
    timeZone: string,
  ): Date {
    try {
      return normalizeDateOnly(
        value ?? getCampusDateString(now, timeZone),
        "Date",
      );
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
  }
}

export function mapLogToSummary(
  log: MedicationAdministrationLog,
): MedicationAdministrationLogSummary {
  return {
    id: log.id,
    outcome: log.outcome,
    recordedByUserId: log.recordedByUserId,
    recordedAt: log.recordedAt,
    actualTime: log.actualTime,
    note: log.note,
    correctionOfLogId: log.correctionOfLogId,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
  };
}

export function mapOccurrenceRecordToItem(
  occurrence: MedicationAdministrationOccurrence,
  latestLog: MedicationAdministrationLog,
): MedicationAdministrationRecordResult {
  return {
    occurrenceId: occurrence.id,
    status: occurrence.latestOutcome as MedicationAdministrationOutcome,
    isOverdue: false,
    latestLog: mapLogToSummary(latestLog),
    latestOutcome: occurrence.latestOutcome,
    latestLogId: occurrence.latestLogId,
    latestRecordedAt: occurrence.latestRecordedAt,
    latestRecordedByUserId: occurrence.latestRecordedByUserId,
    latestNote: occurrence.latestNote,
    updatedAt: occurrence.updatedAt,
  };
}

export interface MedicationAdministrationRecordResult {
  occurrenceId: string;
  status: MedicationAdministrationOutcome;
  isOverdue: boolean;
  latestLog: MedicationAdministrationLogSummary;
  latestOutcome: MedicationAdministrationOutcome | null;
  latestLogId: string | null;
  latestRecordedAt: Date | null;
  latestRecordedByUserId: string | null;
  latestNote: string | null;
  updatedAt: Date;
}

export function mapQueueRowToItem(
  row: MedicationAdministrationQueueRow,
  now: Date,
  timeZone: string,
): MedicationAdministrationQueueItem {
  const { occurrence } = row;
  const status = deriveMedicationAdministrationStatus(
    occurrence,
    now,
    timeZone,
  );

  return {
    occurrenceId: occurrence.id,
    requestId: row.request.id,
    medicationItemId: row.medicationItem.id,
    student: row.student,
    class: row.class,
    medicationName: row.medicationItem.medicationName,
    dosage: row.medicationItem.dosage,
    instructions: row.medicationItem.instructions,
    dueDate: occurrence.dueDate,
    dueTime: occurrence.dueTime,
    status,
    isOverdue: status === MedicationAdministrationStatus.OVERDUE,
    parentNotes: row.request.parentNotes,
    latestLog: row.latestLog ? mapLogToSummary(row.latestLog) : null,
    latestOutcome: occurrence.latestOutcome,
    latestLogId: occurrence.latestLogId,
    latestRecordedAt: occurrence.latestRecordedAt,
    latestRecordedByUserId: occurrence.latestRecordedByUserId,
    latestNote: occurrence.latestNote,
    createdAt: occurrence.createdAt,
    updatedAt: occurrence.updatedAt,
  };
}

export function deriveMedicationAdministrationStatus(
  occurrence: MedicationAdministrationOccurrence,
  now: Date,
  timeZone = "UTC",
): MedicationAdministrationStatus {
  if (occurrence.latestOutcome) {
    return occurrence.latestOutcome as unknown as MedicationAdministrationStatus;
  }

  return isOccurrenceOverdue(occurrence, now, timeZone)
    ? MedicationAdministrationStatus.OVERDUE
    : MedicationAdministrationStatus.DUE;
}

function isOccurrenceOverdue(
  occurrence: MedicationAdministrationOccurrence,
  now: Date,
  timeZone: string,
): boolean {
  return (
    getMedicationOccurrenceDueAt(occurrence, timeZone).getTime() < now.getTime()
  );
}

function compareQueueRows(
  left: MedicationAdministrationQueueRow,
  right: MedicationAdministrationQueueRow,
): number {
  return (
    left.occurrence.dueMinute - right.occurrence.dueMinute ||
    left.student.fullName.localeCompare(right.student.fullName) ||
    left.medicationItem.medicationName.localeCompare(
      right.medicationItem.medicationName,
    ) ||
    left.medicationItem.id.localeCompare(right.medicationItem.id)
  );
}
