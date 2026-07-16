import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import {
  MedicationAdministrationDailyParams,
  MedicationAdministrationHealthCenterDailyParams,
  MedicationAdministrationHealthCenterSummaryCounts,
  MedicationAdministrationHealthCenterSummaryParams,
  MedicationAdministrationQueueRow,
  MedicationAdministrationRepository,
} from "@/application/medication";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  MedicationAdministrationLog,
  MedicationAdministrationOccurrence,
  normalizeDateOnly,
} from "@/domain/medication";

import {
  campusWallTimeToInstant,
  getCampusDateOnly,
} from "@/core/time/campus-time-zone";

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
    params: MedicationAdministrationHealthCenterSummaryParams,
  ): Promise<MedicationAdministrationHealthCenterSummaryCounts> {
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

  async findHealthCenterDailyByCampus(
    campusId: string,
    params: MedicationAdministrationHealthCenterDailyParams,
  ): Promise<MedicationAdministrationQueueRow[]> {
    const rows = await this.prisma.medicationAdministrationOccurrence.findMany({
      where: buildUnrecordedOccurrenceWhere(
        campusId,
        params.dueDate,
        params.classId,
      ),
      include: buildDailyQueueInclude(campusId, params.dueDate, params.classId),
      orderBy: [
        { dueMinute: "asc" },
        { student: { fullName: "asc" } },
        { medicationItem: { medicationName: "asc" } },
        { medicationItemId: "asc" },
      ],
      skip: params.offset,
      take: params.limit,
    });

    return rows.map((row) =>
      PrismaMedicationAdministrationMapper.toQueueRow(row),
    );
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
  params: MedicationAdministrationHealthCenterSummaryParams,
): Prisma.MedicationAdministrationOccurrenceWhereInput | null {
  const dueDate = normalizeDateOnly(params.dueDate, "Due date");
  const today = getCampusDateOnly(params.now, params.timeZone);
  const dateComparison = compareDateOnly(dueDate, today);

  if (dateComparison < 0) {
    return null;
  }

  const where = buildUnrecordedOccurrenceWhere(
    campusId,
    dueDate,
    params.classId,
  );

  if (dateComparison === 0) {
    where.dueMinute = getDueMinutePredicate(
      dueDate,
      params.now,
      params.timeZone,
      "due",
    );
  }

  return where;
}

function buildOverdueSummaryWhere(
  campusId: string,
  params: MedicationAdministrationHealthCenterSummaryParams,
): Prisma.MedicationAdministrationOccurrenceWhereInput | null {
  const dueDate = normalizeDateOnly(params.dueDate, "Due date");
  const today = getCampusDateOnly(params.now, params.timeZone);
  const dateComparison = compareDateOnly(dueDate, today);

  if (dateComparison > 0) {
    return null;
  }

  const where = buildUnrecordedOccurrenceWhere(
    campusId,
    dueDate,
    params.classId,
  );

  if (dateComparison === 0) {
    where.dueMinute = getDueMinutePredicate(
      dueDate,
      params.now,
      params.timeZone,
      "overdue",
    );
  }

  return where;
}

function buildUnrecordedOccurrenceWhere(
  campusId: string,
  dueDate: Date,
  classId?: string,
): Prisma.MedicationAdministrationOccurrenceWhereInput {
  return {
    campusId,
    dueDate,
    latestOutcome: null,
    ...(classId
      ? {
          student: {
            enrollments: {
              some: buildSelectedDateEnrollmentWhere(
                campusId,
                dueDate,
                classId,
              ),
            },
          },
        }
      : {}),
  };
}

function getDueMinutePredicate(
  dueDate: Date,
  now: Date,
  timeZone: string,
  mode: "due" | "overdue",
): Prisma.IntFilter {
  let lowerBound = 0;
  let upperBound = 24 * 60;

  while (lowerBound < upperBound) {
    const candidateMinute = Math.floor((lowerBound + upperBound) / 2);
    const candidateInstant = campusWallTimeToInstant(
      dueDate,
      candidateMinute,
      timeZone,
    );

    if (candidateInstant.getTime() < now.getTime()) {
      lowerBound = candidateMinute + 1;
    } else {
      upperBound = candidateMinute;
    }
  }

  return mode === "overdue" ? { lt: lowerBound } : { gte: lowerBound };
}

function compareDateOnly(left: Date, right: Date): number {
  return left.getTime() === right.getTime()
    ? 0
    : left.getTime() < right.getTime()
      ? -1
      : 1;
}
