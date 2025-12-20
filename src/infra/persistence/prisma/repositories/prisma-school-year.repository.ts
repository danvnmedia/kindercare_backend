import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { SchoolYearRepository } from "@/application/class-management/ports/school-year.repository";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { PrismaSchoolYearMapper } from "../mapper/prisma-school-year.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaSchoolYearRepository implements SchoolYearRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<SchoolYear | null> {
    const prismaSchoolYear = await this.prisma.schoolYear.findUnique({
      where: { id },
    });
    return prismaSchoolYear
      ? PrismaSchoolYearMapper.toDomain(prismaSchoolYear)
      : null;
  }

  async findByName(name: string): Promise<SchoolYear | null> {
    const prismaSchoolYear = await this.prisma.schoolYear.findFirst({
      where: { name },
    });
    return prismaSchoolYear
      ? PrismaSchoolYearMapper.toDomain(prismaSchoolYear)
      : null;
  }

  async findNonArchived(): Promise<SchoolYear[]> {
    const prismaSchoolYears = await this.prisma.schoolYear.findMany({
      where: { isArchived: false },
      orderBy: { startDate: "desc" },
    });
    return PrismaSchoolYearMapper.toDomainArray(prismaSchoolYears);
  }

  async findAll(params: StandardRequest): Promise<PaginatedResult<SchoolYear>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = ["name", "isArchived", "startDate", "endDate"];
    params.allowedSortFields = [
      "name",
      "startDate",
      "endDate",
      "createdAt",
      "updatedAt",
    ];

    return await this.queryService.executeQuery<SchoolYear>(
      this.prisma,
      "schoolYear",
      params,
      {
        orderBy: { startDate: "desc" }, // Default sort: most recent first
      },
      PrismaSchoolYearMapper,
    );
  }

  async save(schoolYear: SchoolYear): Promise<SchoolYear> {
    const prismaData = PrismaSchoolYearMapper.toPrisma(schoolYear);
    const created = await this.prisma.schoolYear.create({
      data: prismaData,
    });
    return PrismaSchoolYearMapper.toDomain(created);
  }

  async update(schoolYear: SchoolYear): Promise<SchoolYear> {
    const prismaData = PrismaSchoolYearMapper.toPrismaUpdate(schoolYear);
    const updated = await this.prisma.schoolYear.update({
      where: { id: schoolYear.id },
      data: prismaData,
    });
    return PrismaSchoolYearMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.schoolYear.delete({
      where: { id },
    });
  }

  async archive(id: string): Promise<SchoolYear> {
    const updated = await this.prisma.schoolYear.update({
      where: { id },
      data: { isArchived: true },
    });
    return PrismaSchoolYearMapper.toDomain(updated);
  }

  async unarchive(id: string): Promise<SchoolYear> {
    const updated = await this.prisma.schoolYear.update({
      where: { id },
      data: { isArchived: false },
    });
    return PrismaSchoolYearMapper.toDomain(updated);
  }
}
