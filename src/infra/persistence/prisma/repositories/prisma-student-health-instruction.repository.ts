import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import {
  HealthCenterClassSummary,
  HealthCenterInstructionListParams,
  HealthCenterInstructionListResult,
  HealthCenterStudentSummary,
  StudentHealthInstructionListParams,
  StudentHealthInstructionRepository,
} from "@/application/student-health";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  StudentHealthInstruction,
  StudentHealthInstructionStatus,
  normalizeReferenceDate,
} from "@/domain/student-health";

import { PrismaStudentHealthInstructionMapper } from "../mapper/prisma-student-health-instruction.mapper";
import { PrismaService } from "../prisma.service";

const ALLOWED_FIELDS = [
  "instructionType",
  "title",
  "instruction",
  "dosage",
  "startDate",
  "endDate",
  "timesOfDay",
  "scheduleNotes",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt",
];

@Injectable()
export class PrismaStudentHealthInstructionRepository
  implements StudentHealthInstructionRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findByStudentInCampus(
    campusId: string,
    studentId: string,
    params: StudentHealthInstructionListParams,
  ): Promise<PaginatedResult<StudentHealthInstruction>> {
    params.allowedFilterFields = ALLOWED_FIELDS;
    params.allowedSortFields = ALLOWED_FIELDS;
    this.parseStandardQueryParams(params);

    const referenceDate = params.date
      ? normalizeReferenceDate(params.date)
      : normalizeReferenceDate(new Date());

    const filterWhere = this.queryService.buildWhereClause(
      params,
      ALLOWED_FIELDS,
      ["startDate", "endDate", "createdAt", "updatedAt"],
    );
    const derivedWhere = buildStatusWhere(params.status, referenceDate);
    const where: Prisma.StudentHealthInstructionWhereInput = {
      AND: [
        filterWhere,
        derivedWhere,
        {
          campusId,
          studentId,
        },
      ],
    };

    const orderBy = this.queryService.buildOrderByClause(
      params,
      ALLOWED_FIELDS,
    ) ?? {
      startDate: "desc" as const,
    };
    const { take, skip } = this.queryService.buildPaginationParams(params);

    const [rows, count] = await Promise.all([
      this.prisma.studentHealthInstruction.findMany({
        where,
        include: PrismaStudentHealthInstructionMapper.include,
        orderBy,
        take,
        skip,
      }),
      this.prisma.studentHealthInstruction.count({ where }),
    ]);

    const limit = Math.min(
      Number(params.limit) || params.defaultLimit || 10,
      params.maxLimit || 50,
    );
    const offset = Number(params.offset) || 0;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(count / limit);

    return {
      data: rows.map((row) =>
        PrismaStudentHealthInstructionMapper.toDomain(row),
      ),
      pagination: {
        count,
        limit,
        offset,
        totalPages,
        currentPage,
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1,
      },
    };
  }

  async findByIdForStudentInCampus(
    campusId: string,
    studentId: string,
    instructionId: string,
  ): Promise<StudentHealthInstruction | null> {
    const row = await this.prisma.studentHealthInstruction.findFirst({
      where: { id: instructionId, campusId, studentId },
      include: PrismaStudentHealthInstructionMapper.include,
    });

    return row ? PrismaStudentHealthInstructionMapper.toDomain(row) : null;
  }

  async findActiveByStudentInCampus(
    campusId: string,
    studentId: string,
    referenceDate: Date,
  ): Promise<StudentHealthInstruction[]> {
    const rows = await this.prisma.studentHealthInstruction.findMany({
      where: {
        campusId,
        studentId,
        ...buildStatusWhere(
          StudentHealthInstructionStatus.ACTIVE,
          referenceDate,
        ),
      },
      include: PrismaStudentHealthInstructionMapper.include,
      orderBy: [{ startDate: "asc" }, { title: "asc" }],
    });

    return rows.map((row) =>
      PrismaStudentHealthInstructionMapper.toDomain(row),
    );
  }

  async findActiveByStudentsInCampus(
    campusId: string,
    studentIds: string[],
    referenceDate: Date,
  ): Promise<StudentHealthInstruction[]> {
    if (studentIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.studentHealthInstruction.findMany({
      where: {
        campusId,
        studentId: { in: studentIds },
        ...buildStatusWhere(
          StudentHealthInstructionStatus.ACTIVE,
          referenceDate,
        ),
      },
      include: PrismaStudentHealthInstructionMapper.include,
      orderBy: [{ studentId: "asc" }, { startDate: "asc" }, { title: "asc" }],
    });

    return rows.map((row) =>
      PrismaStudentHealthInstructionMapper.toDomain(row),
    );
  }

  async findActiveForHealthCenter(
    params: HealthCenterInstructionListParams,
  ): Promise<HealthCenterInstructionListResult> {
    const selectedDate = toDateOnly(params.referenceDate);
    const where: Prisma.StudentHealthInstructionWhereInput = {
      campusId: params.campusId,
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
      ...buildStatusWhere(StudentHealthInstructionStatus.ACTIVE, selectedDate),
    };

    const [rows, total] = await Promise.all([
      this.prisma.studentHealthInstruction.findMany({
        where,
        include: buildHealthCenterInstructionInclude(
          params.campusId,
          selectedDate,
          params.classId,
        ),
        orderBy: [
          { startDate: "asc" },
          { student: { fullName: "asc" } },
          { createdAt: "asc" },
        ],
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.studentHealthInstruction.count({ where }),
    ]);

    return {
      data: rows.map((row) => ({
        instruction: PrismaStudentHealthInstructionMapper.toDomain(row),
        student: toHealthCenterStudentSummary(row.student),
        class: toHealthCenterClassSummary(row.student.enrollments[0]?.class),
      })),
      total,
    };
  }

  async create(
    instruction: StudentHealthInstruction,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthInstruction> {
    const client = tx ?? this.prisma;
    const created = await client.studentHealthInstruction.create({
      data: PrismaStudentHealthInstructionMapper.toPrismaCreate(instruction),
      include: PrismaStudentHealthInstructionMapper.include,
    });

    return PrismaStudentHealthInstructionMapper.toDomain(created);
  }

  async update(
    instruction: StudentHealthInstruction,
    tx?: AppTransactionClient,
  ): Promise<StudentHealthInstruction> {
    const client = tx ?? this.prisma;
    const updated = await client.studentHealthInstruction.update({
      where: { id: instruction.id },
      data: PrismaStudentHealthInstructionMapper.toPrismaUpdate(instruction),
      include: PrismaStudentHealthInstructionMapper.include,
    });

    return PrismaStudentHealthInstructionMapper.toDomain(updated);
  }

  private parseStandardQueryParams(
    params: StudentHealthInstructionListParams,
  ): void {
    if (
      !params.filterInfo ||
      Object.keys(params.filterInfo.filters || {}).length === 0
    ) {
      if (params.filter && typeof params.filter === "string") {
        try {
          params.filterInfo = { filters: JSON.parse(params.filter) };
        } catch {
          params.filterInfo = { filters: {} };
        }
      } else {
        params.filterInfo = { filters: {} };
      }
    }

    if (!params.sortInfo || (params.sortInfo.sorts || []).length === 0) {
      if (params.sort && typeof params.sort === "string") {
        params.sortInfo = {
          sorts: params.sort.split(",").map((item) => {
            const trimmed = item.trim();
            const isDesc = trimmed.startsWith("-");
            const field = isDesc ? trimmed.substring(1) : trimmed;
            return { [field]: isDesc ? "desc" : "asc" };
          }),
        };
      } else {
        params.sortInfo = { sorts: [] };
      }
    }
  }
}

type HealthCenterInstructionStudentRow = {
  id: string;
  fullName: string;
  enrollments: Array<{
    class: {
      id: string;
      name: string;
    };
  }>;
};

function buildStatusWhere(
  status: StudentHealthInstructionStatus | undefined,
  referenceDate: Date,
): Prisma.StudentHealthInstructionWhereInput {
  const date = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
    ),
  );

  switch (status) {
    case StudentHealthInstructionStatus.INACTIVE:
      return { isActive: false };
    case StudentHealthInstructionStatus.UPCOMING:
      return { isActive: true, startDate: { gt: date } };
    case StudentHealthInstructionStatus.ACTIVE:
      return {
        isActive: true,
        startDate: { lte: date },
        OR: [{ endDate: null }, { endDate: { gte: date } }],
      };
    case StudentHealthInstructionStatus.EXPIRED:
      return { isActive: true, endDate: { lt: date } };
    default:
      return {};
  }
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

function buildHealthCenterInstructionInclude(
  campusId: string,
  selectedDate: Date,
  classId?: string,
) {
  return {
    ...PrismaStudentHealthInstructionMapper.include,
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
  student: HealthCenterInstructionStudentRow,
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
