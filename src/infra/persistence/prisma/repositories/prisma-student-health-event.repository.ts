import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  HealthCenterClassSummary,
  HealthCenterEventListParams,
  HealthCenterEventListResult,
  HealthCenterEventScope,
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
          ...(params.includeArchived === true ? {} : { archivedAt: null }),
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
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent | null> {
    const client = tx ?? this.prisma;
    const row = await client.studentHealthEvent.findFirst({
      where: { id: eventId, campusId, studentId },
      include: PrismaStudentHealthEventMapper.include,
    });

    return row ? PrismaStudentHealthEventMapper.toDomain(row) : null;
  }

  async findOpenForHealthCenter(
    params: HealthCenterEventListParams,
  ): Promise<HealthCenterEventListResult> {
    const selectedDate = toDateOnly(params.referenceDate);
    const where = buildHealthCenterEventWhere(params);

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

  async countOpenForHealthCenter(
    params: HealthCenterEventScope,
  ): Promise<number> {
    return this.prisma.studentHealthEvent.count({
      where: buildHealthCenterEventWhere(params),
    });
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

  async archiveIfActive(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent | null> {
    const client = tx ?? this.prisma;
    if (!event.archivedAt || !event.archivedByUserId) {
      throw new Error("Archived health event metadata is required");
    }

    const result = await client.studentHealthEvent.updateMany({
      where: {
        id: event.id,
        campusId: event.campusId,
        studentId: event.studentId,
        archivedAt: null,
        student: { isArchived: false },
      },
      data: {
        archivedAt: event.archivedAt,
        archivedByUserId: event.archivedByUserId,
        updatedAt: event.updatedAt,
      },
    });

    return result.count === 1
      ? this.findByIdForStudentInCampus(
          event.campusId,
          event.studentId,
          event.id,
          tx,
        )
      : null;
  }

  async updateIfActive(
    event: StudentHealthEvent,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthEvent | null> {
    const client = tx ?? this.prisma;
    const result = await client.studentHealthEvent.updateMany({
      where: {
        id: event.id,
        campusId: event.campusId,
        studentId: event.studentId,
        archivedAt: null,
        student: { isArchived: false },
      },
      data: PrismaStudentHealthEventMapper.toPrismaUpdate(event),
    });

    return result.count === 1
      ? this.findByIdForStudentInCampus(
          event.campusId,
          event.studentId,
          event.id,
          tx,
        )
      : null;
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
    cancelledAt: null,
    enrollmentDate: { lte: selectedDate },
    OR: [{ endDate: null }, { endDate: { gte: selectedDate } }],
  };
}

function buildHealthCenterEventWhere(
  params: HealthCenterEventScope,
): Prisma.StudentHealthEventWhereInput {
  const selectedDate = toDateOnly(params.referenceDate);
  const visibleUntil = minDate(toEndOfDay(selectedDate), params.visibleUntil);

  return {
    campusId: params.campusId,
    archivedAt: null,
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
