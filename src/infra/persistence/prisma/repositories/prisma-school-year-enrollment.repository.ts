import { Injectable } from "@nestjs/common";
import {
  Class as PrismaClass,
  Enrollment as PrismaEnrollment,
  GradeLevel as PrismaGradeLevel,
  Prisma,
  SchoolYear as PrismaSchoolYear,
  SchoolYearEnrollment as PrismaSchoolYearEnrollment,
  Student as PrismaStudent,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  SchoolYearEnrollmentRepository,
  SchoolYearStudentListFilters,
  SchoolYearStudentListItem,
  SchoolYearStudentClassAssignmentState,
  SchoolYearStudentSegment,
} from "@/application/class-management/ports/school-year-enrollment.repository";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { SchoolYearEnrollment } from "@/domain/class-management/entities/school-year-enrollment.entity";
import { Enrollment } from "@/domain/class-management/entities/enrollment.entity";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";
import { PrismaSchoolYearEnrollmentMapper } from "../mapper/prisma-school-year-enrollment.mapper";
import { PrismaEnrollmentMapper } from "../mapper/prisma-enrollment.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  deriveEnrollmentEffectiveStatus,
  toUtcDateOnly,
} from "@/domain/class-management/enrollment-effective-status";
import { EnrollmentEffectiveStatus } from "@/domain/class-management/enums/enrollment-effective-status.enum";

type PrismaSchoolYearStudentEnrollment = PrismaSchoolYearEnrollment & {
  student: PrismaStudent | null;
  schoolYear: PrismaSchoolYear | null;
  gradeLevel: PrismaGradeLevel | null;
  enrollments: Array<
    PrismaEnrollment & {
      class:
        | (PrismaClass & {
            schoolYear: PrismaSchoolYear | null;
            gradeLevel: PrismaGradeLevel | null;
          })
        | null;
      student: PrismaStudent | null;
    }
  >;
  _count: { enrollments: number };
};

@Injectable()
export class PrismaSchoolYearEnrollmentRepository
  implements SchoolYearEnrollmentRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<SchoolYearEnrollment | null> {
    const row = await this.prisma.schoolYearEnrollment.findUnique({
      where: { id },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findOpenByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null> {
    return this.findStructurallyOpenByStudentAndSchoolYear(
      studentId,
      schoolYearId,
    );
  }

  async findStructurallyOpenByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null> {
    const row = await this.prisma.schoolYearEnrollment.findFirst({
      where: { studentId, schoolYearId, exitDate: null, cancelledAt: null },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findCoveringDateByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
    effectiveDate: Date,
  ): Promise<SchoolYearEnrollment | null> {
    const date = toUtcDateOnly(effectiveDate);
    const row = await this.prisma.schoolYearEnrollment.findFirst({
      where: {
        studentId,
        schoolYearId,
        cancelledAt: null,
        enrollmentDate: { lte: date },
        OR: [{ exitDate: null }, { exitDate: { gte: date } }],
      },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
      orderBy: [{ enrollmentDate: "desc" }, { id: "desc" }],
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findUpcomingByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
    referenceDate: Date,
  ): Promise<SchoolYearEnrollment[]> {
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: {
        studentId,
        schoolYearId,
        cancelledAt: null,
        enrollmentDate: { gt: toUtcDateOnly(referenceDate) },
      },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
      orderBy: [{ enrollmentDate: "asc" }, { id: "asc" }],
    });
    return PrismaSchoolYearEnrollmentMapper.toDomainArray(rows);
  }

  async findLatestByStudentAndSchoolYear(
    studentId: string,
    schoolYearId: string,
  ): Promise<SchoolYearEnrollment | null> {
    const row = await this.prisma.schoolYearEnrollment.findFirst({
      where: { studentId, schoolYearId },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
      orderBy: [{ exitDate: "desc" }, { enrollmentDate: "desc" }],
    });
    return row ? PrismaSchoolYearEnrollmentMapper.toDomain(row) : null;
  }

  async findAllByStudentId(studentId: string): Promise<SchoolYearEnrollment[]> {
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: { studentId },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomainArray(rows);
  }

  async findAllByStudentIdWithChildCount(
    studentId: string,
  ): Promise<
    Array<{ enrollment: SchoolYearEnrollment; childEnrollmentCount: number }>
  > {
    const rows = await this.prisma.schoolYearEnrollment.findMany({
      where: { studentId },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
        _count: {
          select: { enrollments: { where: { cancelledAt: null } } },
        },
      },
      orderBy: { enrollmentDate: "desc" },
    });
    return rows.map((row) => ({
      enrollment: PrismaSchoolYearEnrollmentMapper.toDomain(row),
      childEnrollmentCount: row._count.enrollments,
    }));
  }

  async findStudentsBySchoolYear(
    campusId: string,
    schoolYearId: string,
    params: StandardRequest,
    referenceDate: Date,
    filters: SchoolYearStudentListFilters = {},
  ): Promise<PaginatedResult<SchoolYearStudentListItem>> {
    const segment = filters.segment ?? "registered";
    const scopedWhere: Prisma.SchoolYearEnrollmentWhereInput = {
      campusId,
      schoolYearId,
    };
    const referenceDay = toUtcDateOnly(referenceDate);
    const segmentWhere = buildSegmentWhere(segment, referenceDay);
    const searchWhere = buildSearchWhere(filters.search);
    const andWhere = [segmentWhere, searchWhere].filter(
      (item) => Object.keys(item).length > 0,
    );
    const where: Prisma.SchoolYearEnrollmentWhereInput = andWhere.length
      ? { ...scopedWhere, AND: andWhere }
      : scopedWhere;

    const request = {
      ...params,
      allowedFilterFields: [
        "studentId",
        "gradeLevelId",
        "enrollmentDate",
        "exitDate",
        "exitReason",
      ],
      allowedSortFields: ["enrollmentDate", "exitDate", "createdAt"],
    } as StandardRequest;

    const result =
      await this.queryService.executeQuery<PrismaSchoolYearStudentEnrollment>(
        this.prisma,
        "schoolYearEnrollment",
        request,
        {
          where,
          include: {
            student: true,
            schoolYear: true,
            gradeLevel: true,
            enrollments: {
              include: {
                class: {
                  include: {
                    schoolYear: true,
                    gradeLevel: true,
                  },
                },
                student: true,
              },
              orderBy: [{ enrollmentDate: "desc" }, { createdAt: "desc" }],
            },
            _count: {
              select: { enrollments: { where: { cancelledAt: null } } },
            },
          },
          dateFilterFields: ["enrollmentDate", "exitDate"],
          orderBy: [{ enrollmentDate: "desc" }, { createdAt: "desc" }],
        },
        null,
      );

    return {
      data: result.data.map((row) => {
        const classAssignment = selectClassAssignment(
          row.enrollments,
          referenceDay,
        );
        return {
          enrollment: PrismaSchoolYearEnrollmentMapper.toDomain(row),
          childEnrollmentCount: row._count.enrollments,
          classAssignment: classAssignment
            ? PrismaEnrollmentMapper.toDomain(classAssignment.row)
            : null,
          classAssignmentState: classAssignment?.state ?? "NONE",
        };
      }),
      pagination: result.pagination,
    };
  }

  async countChildEnrollments(schoolYearEnrollmentId: string): Promise<number> {
    return await this.prisma.enrollment.count({
      where: { schoolYearEnrollmentId },
    });
  }

  async save(
    entity: SchoolYearEnrollment,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearEnrollment> {
    const client = tx ?? this.prisma;
    const created = await client.schoolYearEnrollment.create({
      data: PrismaSchoolYearEnrollmentMapper.toPrisma(entity),
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomain(created);
  }

  async update(entity: SchoolYearEnrollment): Promise<SchoolYearEnrollment> {
    const updated = await this.prisma.schoolYearEnrollment.update({
      where: { id: entity.id },
      data: PrismaSchoolYearEnrollmentMapper.toPrismaUpdate(entity),
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomain(updated);
  }

  async correctGradeLevel(
    id: string,
    gradeLevelId: string,
    tx?: AppTransactionClient,
  ): Promise<SchoolYearEnrollment> {
    const client = tx ?? this.prisma;
    const updated = await client.schoolYearEnrollment.update({
      where: { id },
      data: { gradeLevelId, updatedAt: new Date() },
      include: {
        student: true,
        schoolYear: true,
        gradeLevel: true,
      },
    });
    return PrismaSchoolYearEnrollmentMapper.toDomain(updated);
  }

  // Single $transaction wrapping the parent close and the optional child
  // close. Prisma rolls back both on any error inside the callback — see
  // specs/school-year-enrollment-model D4 / AC-7 / AC-8.
  //
  // When `tx` is supplied (e.g. by the audit wiring per
  // @doc/specs/admin-audit-log D4), the inner $transaction is skipped so the
  // caller's transaction owns the atomicity boundary.
  async withdrawWithChildren(
    parent: SchoolYearEnrollment,
    openChild: Enrollment | null,
    tx?: AppTransactionClient,
  ): Promise<{
    closedParent: SchoolYearEnrollment;
    closedChild: Enrollment | null;
  }> {
    const exec = async (
      client: AppTransactionClient,
    ): Promise<{
      closedParent: SchoolYearEnrollment;
      closedChild: Enrollment | null;
    }> => {
      const parentRow = await client.schoolYearEnrollment.update({
        where: { id: parent.id },
        data: PrismaSchoolYearEnrollmentMapper.toPrismaUpdate(parent),
        include: {
          student: true,
          schoolYear: true,
          gradeLevel: true,
        },
      });
      const closedParent = PrismaSchoolYearEnrollmentMapper.toDomain(parentRow);

      let closedChild: Enrollment | null = null;
      if (openChild) {
        const childRow = await client.enrollment.update({
          where: { id: openChild.id },
          data: PrismaEnrollmentMapper.toPrismaUpdate(openChild),
          include: { class: true, student: true },
        });
        closedChild = PrismaEnrollmentMapper.toDomain(childRow);
      }

      return { closedParent, closedChild };
    };
    return tx ? exec(tx) : this.prisma.$transaction(exec);
  }
}

function buildSegmentWhere(
  segment: SchoolYearStudentSegment,
  referenceDay: Date,
): Prisma.SchoolYearEnrollmentWhereInput {
  switch (segment) {
    case "upcoming":
      return {
        cancelledAt: null,
        enrollmentDate: { gt: referenceDay },
      };
    case "active":
      return {
        cancelledAt: null,
        enrollmentDate: { lte: referenceDay },
        OR: [{ exitDate: null }, { exitDate: { gte: referenceDay } }],
        enrollments: {
          some: {
            cancelledAt: null,
            enrollmentDate: { lte: referenceDay },
            OR: [{ endDate: null }, { endDate: { gte: referenceDay } }],
          },
        },
      };
    case "unassigned":
      return {
        cancelledAt: null,
        enrollmentDate: { lte: referenceDay },
        OR: [{ exitDate: null }, { exitDate: { gte: referenceDay } }],
        enrollments: {
          none: {
            cancelledAt: null,
            OR: [{ endDate: null }, { endDate: { gte: referenceDay } }],
          },
        },
      };
    case "withdrawn":
      return {
        cancelledAt: null,
        exitDate: { lt: referenceDay },
        exitReason: ExitReason.WITHDRAWN,
      };
    case "completed":
      return {
        cancelledAt: null,
        exitDate: { lt: referenceDay },
        exitReason: ExitReason.COMPLETED,
      };
    case "graduated":
      return {
        cancelledAt: null,
        exitDate: { lt: referenceDay },
        exitReason: ExitReason.GRADUATED,
      };
    case "unresolved":
      return {
        cancelledAt: null,
        exitDate: { lt: referenceDay },
        OR: [
          { exitReason: null },
          {
            exitReason: {
              notIn: [
                ExitReason.WITHDRAWN,
                ExitReason.COMPLETED,
                ExitReason.GRADUATED,
              ],
            },
          },
        ],
      };
    case "registered":
    default:
      return {};
  }
}

function buildSearchWhere(
  search: string | undefined,
): Prisma.SchoolYearEnrollmentWhereInput {
  const trimmed = search?.trim();
  if (!trimmed) return {};

  return {
    OR: [
      { snapshotStudentFullName: { contains: trimmed, mode: "insensitive" } },
      { snapshotStudentCode: { contains: trimmed, mode: "insensitive" } },
      { snapshotStudentNickname: { contains: trimmed, mode: "insensitive" } },
      { student: { fullName: { contains: trimmed, mode: "insensitive" } } },
      { student: { studentCode: { contains: trimmed, mode: "insensitive" } } },
      { student: { nickname: { contains: trimmed, mode: "insensitive" } } },
    ],
  };
}

function selectClassAssignment(
  enrollments: PrismaSchoolYearStudentEnrollment["enrollments"],
  referenceDate: Date,
): {
  row: PrismaSchoolYearStudentEnrollment["enrollments"][number];
  state: SchoolYearStudentClassAssignmentState;
} | null {
  const ordered = [...enrollments].sort((a, b) => {
    const statusDelta =
      assignmentStatusRank(effectiveStatus(a, referenceDate)) -
      assignmentStatusRank(effectiveStatus(b, referenceDate));
    if (statusDelta !== 0) return statusDelta;
    return b.enrollmentDate.getTime() - a.enrollmentDate.getTime();
  });

  const row = ordered[0];
  return row
    ? {
        row,
        state: toClassAssignmentState(effectiveStatus(row, referenceDate)),
      }
    : null;
}

function effectiveStatus(
  enrollment: PrismaSchoolYearStudentEnrollment["enrollments"][number],
  referenceDate: Date,
): EnrollmentEffectiveStatus {
  return deriveEnrollmentEffectiveStatus({
    enrollmentDate: enrollment.enrollmentDate,
    endDate: enrollment.endDate ?? null,
    cancelledAt: enrollment.cancelledAt ?? null,
    referenceDate,
  });
}

function assignmentStatusRank(status: EnrollmentEffectiveStatus): number {
  return {
    [EnrollmentEffectiveStatus.ACTIVE]: 0,
    [EnrollmentEffectiveStatus.UPCOMING]: 1,
    [EnrollmentEffectiveStatus.CLOSED]: 2,
    [EnrollmentEffectiveStatus.CANCELLED]: 3,
  }[status];
}

function toClassAssignmentState(
  status: EnrollmentEffectiveStatus,
): SchoolYearStudentClassAssignmentState {
  return status;
}
