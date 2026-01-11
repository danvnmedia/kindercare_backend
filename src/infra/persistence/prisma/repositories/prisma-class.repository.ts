import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { Class } from "@/domain/class-management/entities/class.entity";
import { PrismaClassMapper } from "../mapper/prisma-class.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

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
