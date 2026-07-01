import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  HealthCenterClassSummary,
  HealthCenterEventItem,
  HealthCenterEventListParams,
  HealthCenterEventListResult,
  HealthCenterStudentSummary,
  StudentHealthEventListParams,
  StudentHealthEventRepository,
} from "@/application/student-health";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  StudentHealthEvent,
  StudentHealthEventStatus,
} from "@/domain/student-health";

import { PrismaStudentHealthEventMapper } from "../mapper/prisma-student-health-event.mapper";
import { PrismaService } from "../prisma.service";

const ALLOWED_FIELDS = [
  "eventType",
  "category",
  "title",
  "description",
  "occurredAt",
  "status",
  "resolutionNotes",
  "createdAt",
  "updatedAt",
];

@Injectable()
export class PrismaStudentHealthEventRepository
  implements StudentHealthEventRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentHealthEventListParams,
  ): Promise<PaginatedResult<StudentHealthEvent>> {
    params.allowedFilterFields = ALLOWED_FIELDS;
    params.allowedSortFields = ALLOWED_FIELDS;

    return this.queryService.executeQuery<StudentHealthEvent>(
      this.prisma,
      "studentHealthEvent",
      params,
      {
        dateFilterFields: ["occurredAt", "createdAt", "updatedAt"],
        include: PrismaStudentHealthEventMapper.include,
        orderBy: { occurredAt: "desc" },
        scope: {
          campusId,
          studentId,
          ...(params.status ? { status: params.status } : {}),
          ...(params.eventType ? { eventType: params.eventType } : {}),
        },
      },
      PrismaStudentHealthEventMapper,
    );
  }

  async findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    eventId: string,
  ): Promise<StudentHealthEvent | null> {
    const row = await this.prisma.studentHealthEvent.findFirst({
      where: { id: eventId, campusId, studentId },
      include: PrismaStudentHealthEventMapper.include,
    });

    return row ? PrismaStudentHealthEventMapper.toDomain(row) : null;
  }

  async findOpenForHealthCenter(
    params: HealthCenterEventListParams,
  ): Promise<HealthCenterEventListResult> {
    const selectedDate = toDateOnly(params.referenceDate);
    const selectedDayEnd = toEndOfDay(selectedDate);
    const visibleUntil = minDate(selectedDayEnd, new Date(Date.now()));
    const where: Prisma.StudentHealthEventWhereInput = {
      campusId: params.campusId,
      status: StudentHealthEventStatus.OPEN,
      occurredAt: { lte: visibleUntil },
      student: {
        campusId: params.campusId,
        ...(params.classId
          ? {
              enrollments: {
                some: buildSelectedDateEnrollmentWhere(
                  params.campusId,
                  selectedDate,
                  params.classId,
                ),
              },
            }
          : {}),
      },
    };

    const [rows, total] = await Promise.all([
      this.prisma.studentHealthEvent.findMany({
        where,
        include: buildHealthCenterEventInclude(
          params.campusId,
          selectedDate,
          params.classId,
        ),
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.studentHealthEvent.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        event: PrismaStudentHealthEventMapper.toDomain(row),
        student: toHealthCenterStudentSummary(row.student),
        class: toHealthCenterClassSummary(row.student.enrollments[0]?.class),
      })),
      total,
    };
  }

  async create(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent> {
    const client = tx ?? this.prisma;
    const created = await client.studentHealthEvent.create({
      data: PrismaStudentHealthEventMapper.toPrismaCreate(event),
      include: PrismaStudentHealthEventMapper.include,
    });

    return PrismaStudentHealthEventMapper.toDomain(created);
  }

  async update(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent> {
    const client = tx ?? this.prisma;
    const updated = await client.studentHealthEvent.update({
      where: { id: event.id },
      data: PrismaStudentHealthEventMapper.toPrismaUpdate(event),
      include: PrismaStudentHealthEventMapper.include,
    });

    return PrismaStudentHealthEventMapper.toDomain(updated);
  }
}

type HealthCenterEventStudentRow = {
  id: string;
  fullName: string;
  enrollments: Array<{
    class: {
      id: string;
      name: string;
    };
  }>;
};

function buildSelectedDateEnrollmentWhere(
  campusId: string,
  selectedDate: Date,
  classId?: string,
): Prisma.EnrollmentWhereInput {
  return {
    ...(classId ? { classId } : {}),
    class: { campusId },
    enrollmentDate: { lte: selectedDate },
    OR: [{ endDate: null }, { endDate: { gte: selectedDate } }],
  };
}

function buildHealthCenterEventInclude(
  campusId: string,
  selectedDate: Date,
  classId?: string,
) {
  return {
    ...PrismaStudentHealthEventMapper.include,
    student: {
      select: {
        id: true,
        fullName: true,
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
  };
}

function toHealthCenterStudentSummary(
  student: HealthCenterEventStudentRow,
): HealthCenterStudentSummary {
  return {
    id: student.id,
    fullName: student.fullName,
    avatarUrl: null,
  };
}

function toHealthCenterClassSummary(
  classRow: { id: string; name: string } | undefined,
): HealthCenterClassSummary | null {
  return classRow
    ? {
        id: classRow.id,
        name: classRow.name,
      }
    : null;
}

function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function toEndOfDay(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function minDate(left: Date, right: Date): Date {
  return left.getTime() <= right.getTime() ? left : right;
}
