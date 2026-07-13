import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  MedicationAdministrationDailyParams,
  MedicationAdministrationQueueRow,
  MedicationAdministrationRepository,
} from "@/application/medication";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOccurrence,
  normalizeDateOnly,
} from "@/domain/medication";

import { PrismaMedicationAdministrationMapper } from "../mapper/prisma-medication-administration.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaMedicationAdministrationRepository
  implements MedicationAdministrationRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findDailyByCampus(
    campusId: string,
    params: MedicationAdministrationDailyParams,
  ): Promise<MedicationAdministrationQueueRow[]> {
    const rows = await this.prisma.medicationAdministrationOccurrence.findMany({
      where: this.buildDailyWhere(campusId, params),
      include: buildDailyQueueInclude(campusId, params.dueDate, params.classId),
      orderBy: [{ dueMinute: "asc" }],
    });

    return rows.map((row) =>
      PrismaMedicationAdministrationMapper.toQueueRow(row),
    );
  }

  async countHealthCenterSummaryByCampus(
    campusId: string,
    params: {
      dueDate: Date;
      now: Date;
    },
  ): Promise<{
    dueToday: number;
    overdue: number;
  }> {
    const dueWhere = buildDueTodaySummaryWhere(campusId, params);
    const overdueWhere = buildOverdueSummaryWhere(campusId, params);

    const [dueToday, overdue] = await Promise.all([
      dueWhere
        ? this.prisma.medicationAdministrationOccurrence.count({
            where: dueWhere,
          })
        : Promise.resolve(0),
      overdueWhere
        ? this.prisma.medicationAdministrationOccurrence.count({
            where: overdueWhere,
          })
        : Promise.resolve(0),
    ]);

    return {
      dueToday,
      overdue,
    };
  }

  async findOccurrenceByIdInCampus(
    campusId: string,
    occurrenceId: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationOccurrence | null> {
    const client = tx ?? this.prisma;
    const row = await client.medicationAdministrationOccurrence.findFirst({
      where: { id: occurrenceId, campusId },
    });

    return row
      ? PrismaMedicationAdministrationMapper.toOccurrenceDomain(row)
      : null;
  }

  async findLogByIdForOccurrence(
    occurrenceId: string,
    logId: string,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationLog | null> {
    const client = tx ?? this.prisma;
    const row = await client.medicationAdministrationLog.findFirst({
      where: { id: logId, occurrenceId },
    });

    return row ? PrismaMedicationAdministrationMapper.toLogDomain(row) : null;
  }

  async createLog(
    log: MedicationAdministrationLog,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationLog> {
    const client = tx ?? this.prisma;
    const created = await client.medicationAdministrationLog.create({
      data: PrismaMedicationAdministrationMapper.toPrismaLogCreate(log),
    });

    return PrismaMedicationAdministrationMapper.toLogDomain(created);
  }

  async updateOccurrenceLatestIfExpected(
    occurrence: MedicationAdministrationOccurrence,
    expectedLatestLogId: string | null,
    tx?: AppTransactionClient,
  ): Promise<MedicationAdministrationOccurrence | null> {
    const client = tx ?? this.prisma;
    const result = await client.medicationAdministrationOccurrence.updateMany({
      where: {
        id: occurrence.id,
        campusId: occurrence.campusId,
        latestLogId: expectedLatestLogId,
      },
      data: PrismaMedicationAdministrationMapper.toPrismaOccurrenceLatestUpdate(
        occurrence,
      ),
    });

    if (result.count === 0) {
      return null;
    }

    return this.findOccurrenceByIdInCampus(
      occurrence.campusId,
      occurrence.id,
      tx,
    );
  }

  private buildDailyWhere(
    campusId: string,
    params: MedicationAdministrationDailyParams,
  ): Prisma.MedicationAdministrationOccurrenceWhereInput {
    const where: Prisma.MedicationAdministrationOccurrenceWhereInput = {
      campusId,
      dueDate: params.dueDate,
    };

    if (params.studentId) {
      where.studentId = params.studentId;
    }

    if (params.classId) {
      where.student = {
        enrollments: {
          some: buildSelectedDateEnrollmentWhere(
            campusId,
            params.dueDate,
            params.classId,
          ),
        },
      };
    }

    return where;
  }
}

function buildDailyQueueInclude(
  campusId: string,
  selectedDate: Date,
  classId?: string,
) {
  return {
    request: {
      select: {
        id: true,
        parentNotes: true,
      },
    },
    medicationItem: {
      select: {
        id: true,
        medicationName: true,
        dosage: true,
        instructions: true,
      },
    },
    student: {
      include: {
        enrollments: {
          where: buildSelectedDateEnrollmentWhere(
            campusId,
            selectedDate,
            classId,
          ),
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { enrollmentDate: "desc" as const },
          take: 1,
        },
      },
    },
    latestLog: true,
  } satisfies Prisma.MedicationAdministrationOccurrenceInclude;
}

function buildSelectedDateEnrollmentWhere(
  campusId: string,
  selectedDate: Date,
  classId?: string,
): Prisma.EnrollmentWhereInput {
  return {
    ...(classId ? { classId } : {}),
    class: { campusId },
    cancelledAt: null,
    enrollmentDate: { lte: selectedDate },
    OR: [{ endDate: null }, { endDate: { gte: selectedDate } }],
  };
}

function buildDueTodaySummaryWhere(
  campusId: string,
  params: {
    dueDate: Date;
    now: Date;
  },
): Prisma.MedicationAdministrationOccurrenceWhereInput | null {
  const dueDate = normalizeDateOnly(params.dueDate, "Due date");
  const today = normalizeDateOnly(toServerDateOnly(params.now), "Date");
  const dateComparison = compareDateOnly(dueDate, today);

  if (dateComparison < 0) {
    return null;
  }

  const where = buildUnrecordedOccurrenceWhere(campusId, dueDate);

  if (dateComparison === 0) {
    where.dueMinute = getDueMinutePredicate(dueDate, params.now, "due");
  }

  return where;
}

function buildOverdueSummaryWhere(
  campusId: string,
  params: {
    dueDate: Date;
    now: Date;
  },
): Prisma.MedicationAdministrationOccurrenceWhereInput | null {
  const dueDate = normalizeDateOnly(params.dueDate, "Due date");
  const today = normalizeDateOnly(toServerDateOnly(params.now), "Date");
  const dateComparison = compareDateOnly(dueDate, today);

  if (dateComparison > 0) {
    return null;
  }

  const where = buildUnrecordedOccurrenceWhere(campusId, dueDate);

  if (dateComparison === 0) {
    where.dueMinute = getDueMinutePredicate(dueDate, params.now, "overdue");
  }

  return where;
}

function buildUnrecordedOccurrenceWhere(
  campusId: string,
  dueDate: Date,
): Prisma.MedicationAdministrationOccurrenceWhereInput {
  return {
    campusId,
    dueDate,
    latestOutcome: null,
  };
}

function getDueMinutePredicate(
  dueDate: Date,
  now: Date,
  mode: "due" | "overdue",
): Prisma.IntFilter {
  const elapsedMs = now.getTime() - dueDate.getTime();
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const partialMinuteElapsed = elapsedMs % 60000 > 0;

  if (mode === "overdue") {
    return partialMinuteElapsed
      ? { lte: elapsedMinutes }
      : { lt: elapsedMinutes };
  }

  return partialMinuteElapsed
    ? { gt: elapsedMinutes }
    : { gte: elapsedMinutes };
}

function compareDateOnly(left: Date, right: Date): number {
  return left.getTime() === right.getTime()
    ? 0
    : left.getTime() < right.getTime()
      ? -1
      : 1;
}

function toServerDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
