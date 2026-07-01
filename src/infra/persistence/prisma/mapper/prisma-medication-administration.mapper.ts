import {
  Class as PrismaClass,
  Enrollment as PrismaEnrollment,
  MedicationAdministrationLog as PrismaMedicationAdministrationLog,
  MedicationAdministrationOccurrence as PrismaMedicationAdministrationOccurrence,
  MedicationRequest as PrismaMedicationRequest,
  MedicationRequestItem as PrismaMedicationRequestItem,
  Prisma,
  Student as PrismaStudent,
} from "@prisma/client";

import { MedicationAdministrationQueueRow } from "@/application/medication";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOccurrence,
  MedicationAdministrationOutcome,
} from "@/domain/medication";

type PrismaStudentWithCurrentClass = PrismaStudent & {
  enrollments?: (PrismaEnrollment & {
    class?: Pick<PrismaClass, "id" | "name"> | null;
  })[];
};

export type PrismaMedicationAdministrationOccurrenceWithRelations =
  PrismaMedicationAdministrationOccurrence & {
    request?: Pick<PrismaMedicationRequest, "id" | "parentNotes"> | null;
    medicationItem?: Pick<
      PrismaMedicationRequestItem,
      "id" | "medicationName" | "dosage" | "instructions"
    > | null;
    student?: PrismaStudentWithCurrentClass | null;
    latestLog?: PrismaMedicationAdministrationLog | null;
  };

export class PrismaMedicationAdministrationMapper {
  static toOccurrenceDomain(
    row: PrismaMedicationAdministrationOccurrence,
  ): MedicationAdministrationOccurrence {
    return MedicationAdministrationOccurrence.create(
      {
        requestId: row.requestId,
        medicationItemId: row.medicationItemId,
        campusId: row.campusId,
        studentId: row.studentId,
        dueDate: row.dueDate,
        dueMinute: row.dueMinute,
        latestOutcome: row.latestOutcome as MedicationAdministrationOutcome,
        latestLogId: row.latestLogId,
        latestRecordedAt: row.latestRecordedAt,
        latestRecordedByUserId: row.latestRecordedByUserId,
        latestNote: row.latestNote,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toLogDomain(
    row: PrismaMedicationAdministrationLog,
  ): MedicationAdministrationLog {
    return MedicationAdministrationLog.create(
      {
        occurrenceId: row.occurrenceId,
        outcome: row.outcome as MedicationAdministrationOutcome,
        recordedByUserId: row.recordedByUserId,
        recordedAt: row.recordedAt,
        actualMinute: row.actualMinute,
        note: row.note,
        correctionOfLogId: row.correctionOfLogId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrismaLogCreate(
    log: MedicationAdministrationLog,
  ): Prisma.MedicationAdministrationLogUncheckedCreateInput {
    return {
      id: log.id,
      occurrenceId: log.occurrenceId,
      outcome: log.outcome,
      recordedByUserId: log.recordedByUserId,
      recordedAt: log.recordedAt,
      actualMinute: log.actualMinute,
      note: log.note,
      correctionOfLogId: log.correctionOfLogId,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    };
  }

  static toPrismaOccurrenceLatestUpdate(
    occurrence: MedicationAdministrationOccurrence,
  ): Prisma.MedicationAdministrationOccurrenceUncheckedUpdateManyInput {
    return {
      latestOutcome: occurrence.latestOutcome,
      latestLogId: occurrence.latestLogId,
      latestRecordedAt: occurrence.latestRecordedAt,
      latestRecordedByUserId: occurrence.latestRecordedByUserId,
      latestNote: occurrence.latestNote,
      updatedAt: occurrence.updatedAt,
    };
  }

  static toQueueRow(
    row: PrismaMedicationAdministrationOccurrenceWithRelations,
  ): MedicationAdministrationQueueRow {
    if (!row.request || !row.medicationItem || !row.student) {
      throw new Error(
        "Medication administration queue row is missing relations",
      );
    }

    const currentClass = row.student.enrollments?.[0]?.class ?? null;

    return {
      occurrence: this.toOccurrenceDomain(row),
      request: {
        id: row.request.id,
        parentNotes: row.request.parentNotes,
      },
      medicationItem: {
        id: row.medicationItem.id,
        medicationName: row.medicationItem.medicationName,
        dosage: row.medicationItem.dosage,
        instructions: row.medicationItem.instructions,
      },
      student: {
        id: row.student.id,
        fullName: row.student.fullName,
        studentCode: row.student.studentCode,
      },
      class: currentClass
        ? {
            id: currentClass.id,
            name: currentClass.name,
          }
        : null,
      latestLog: row.latestLog ? this.toLogDomain(row.latestLog) : null,
    };
  }
}
