import { Injectable } from "@nestjs/common";
import {
  Class as PrismaClass,
  GradeLevel as PrismaGradeLevel,
  SchoolYear as PrismaSchoolYear,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  ClassListItemView,
  ClassRepository,
} from "@/application/class-management/ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { PrismaClassMapper } from "../mapper/prisma-class.mapper";
import { PrismaGradeLevelMapper } from "../mapper/prisma-grade-level.mapper";
import { PrismaSchoolYearMapper } from "../mapper/prisma-school-year.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { toUtcDateOnly } from "@/domain/class-management/enrollment-effective-status";

type PrismaClassListRow = PrismaClass & {
  gradeLevel: PrismaGradeLevel | null;
  schoolYear: PrismaSchoolYear | null;
  staff: Array<{
    role: ClassStaffRole;
    createdAt: Date;
    staff: { id: string; fullName: string };
  }>;
};

@Injectable()
export class PrismaClassRepository implements ClassRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<Class | null> {
    const prismaClass = await this.prisma.class.findUnique({
      where: { id },
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    });
    return prismaClass ? PrismaClassMapper.toDomain(prismaClass) : null;
  }

  async findByNameInContextAndCampus(
    name: string,
    campusId: string,
    schoolYearId: string,
    gradeLevelId: string,
  ): Promise<Class | null> {
    const prismaClass = await this.prisma.class.findFirst({
      where: {
        name,
        campusId,
        schoolYearId,
        gradeLevelId,
      },
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    });
    return prismaClass ? PrismaClassMapper.toDomain(prismaClass) : null;
  }

  async findByCampusId(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<Class>> {
    params.allowedFilterFields = [
      "name",
      "description",
      "gradeLevelId",
      "schoolYearId",
    ];
    params.allowedSortFields = ["createdAt", "updatedAt", "name"];

    return await this.queryService.executeQuery<Class>(
      this.prisma,
      "class",
      params,
      {
        where: { campusId },
        include: {
          gradeLevel: true,
          schoolYear: true,
        },
      },
      PrismaClassMapper,
    );
  }

  async findByGradeLevelId(
    gradeLevelId: string,
    campusId: string,
  ): Promise<Class[]> {
    const prismaClasses = await this.prisma.class.findMany({
      where: { gradeLevelId, campusId },
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
      orderBy: { name: "asc" },
    });
    return PrismaClassMapper.toDomainArray(prismaClasses);
  }

  async findBySchoolYearId(
    schoolYearId: string,
    campusId: string,
  ): Promise<Class[]> {
    const prismaClasses = await this.prisma.class.findMany({
      where: { schoolYearId, campusId },
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
      orderBy: { name: "asc" },
    });
    return PrismaClassMapper.toDomainArray(prismaClasses);
  }

  async findByIds(ids: string[]): Promise<Class[]> {
    const prismaClasses = await this.prisma.class.findMany({
      where: { id: { in: ids } },
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    });
    return PrismaClassMapper.toDomainArray(prismaClasses);
  }

  async findAll(
    campusId: string,
    params: StandardRequest,
    referenceDate: Date,
  ): Promise<PaginatedResult<ClassListItemView>> {
    params.allowedFilterFields = [
      "name",
      "description",
      "gradeLevelId",
      "schoolYearId",
    ];
    params.allowedSortFields = ["createdAt", "updatedAt", "name"];

    // Pass `null` MapperClass so executeQuery returns raw Prisma rows and we
    // post-map them to the flat `ClassListItemView` shape below. This keeps
    // the pagination math centralised in `PrismaQueryService` while letting
    // us project the `_count` + nested `staff` joins without polluting the
    // `Class` domain entity.
    const result = await this.queryService.executeQuery<PrismaClassListRow>(
      this.prisma,
      "class",
      params,
      {
        where: { campusId },
        include: {
          gradeLevel: true,
          schoolYear: true,
          staff: {
            include: { staff: { select: { id: true, fullName: true } } },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
        },
      },
      null,
    );

    const classIds = result.data.map((row) => row.id);
    const referenceDay = toUtcDateOnly(referenceDate);
    const [activeCounts, upcomingCounts, historicalCounts] = classIds.length
      ? await Promise.all([
          this.prisma.enrollment.groupBy({
            by: ["classId"],
            where: {
              classId: { in: classIds },
              cancelledAt: null,
              enrollmentDate: { lte: referenceDay },
              OR: [{ endDate: null }, { endDate: { gte: referenceDay } }],
            },
            _count: { _all: true },
          }),
          this.prisma.enrollment.groupBy({
            by: ["classId"],
            where: {
              classId: { in: classIds },
              cancelledAt: null,
              enrollmentDate: { gt: referenceDay },
            },
            _count: { _all: true },
          }),
          this.prisma.enrollment.groupBy({
            by: ["classId"],
            where: {
              classId: { in: classIds },
              cancelledAt: null,
              endDate: { lt: referenceDay },
            },
            _count: { _all: true },
          }),
        ])
      : [[], [], []];

    const activeCountByClassId = new Map(
      activeCounts.map((row) => [row.classId, row._count._all]),
    );
    const historicalCountByClassId = new Map(
      historicalCounts.map((row) => [row.classId, row._count._all]),
    );
    const upcomingCountByClassId = new Map(
      upcomingCounts.map((row) => [row.classId, row._count._all]),
    );

    const data: ClassListItemView[] = result.data.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      campusId: row.campusId,
      gradeLevelId: row.gradeLevelId,
      schoolYearId: row.schoolYearId,
      gradeLevel: row.gradeLevel
        ? PrismaGradeLevelMapper.toDomain(row.gradeLevel)
        : null,
      schoolYear: row.schoolYear
        ? PrismaSchoolYearMapper.toDomain(row.schoolYear)
        : null,
      activeStudentCount: activeCountByClassId.get(row.id) ?? 0,
      upcomingStudentCount: upcomingCountByClassId.get(row.id) ?? 0,
      historicalStudentCount: historicalCountByClassId.get(row.id) ?? 0,
      staff: row.staff.map((cs) => ({
        id: cs.staff.id,
        fullName: cs.staff.fullName,
        role: cs.role,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    return { data, pagination: result.pagination };
  }

  async save(classEntity: Class): Promise<Class> {
    const prismaData = PrismaClassMapper.toPrisma(classEntity);
    const created = await this.prisma.class.create({
      data: prismaData,
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    });
    return PrismaClassMapper.toDomain(created);
  }

  async update(classEntity: Class): Promise<Class> {
    const prismaData = PrismaClassMapper.toPrismaUpdate(classEntity);
    const updated = await this.prisma.class.update({
      where: { id: classEntity.id },
      data: prismaData,
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    });
    return PrismaClassMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.class.delete({
      where: { id },
    });
  }
}
