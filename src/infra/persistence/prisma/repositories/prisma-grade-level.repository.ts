import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { PrismaGradeLevelMapper } from "../mapper/prisma-grade-level.mapper";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";

@Injectable()
export class PrismaGradeLevelRepository implements GradeLevelRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<GradeLevel | null> {
    const prismaGradeLevel = await this.prisma.gradeLevel.findUnique({
      where: { id },
    });
    return prismaGradeLevel
      ? PrismaGradeLevelMapper.toDomain(prismaGradeLevel)
      : null;
  }

  async findByName(name: string): Promise<GradeLevel | null> {
    const prismaGradeLevel = await this.prisma.gradeLevel.findFirst({
      where: { name },
    });
    return prismaGradeLevel
      ? PrismaGradeLevelMapper.toDomain(prismaGradeLevel)
      : null;
  }

  async findByOrder(order: number): Promise<GradeLevel | null> {
    const prismaGradeLevel = await this.prisma.gradeLevel.findFirst({
      where: { order },
    });
    return prismaGradeLevel
      ? PrismaGradeLevelMapper.toDomain(prismaGradeLevel)
      : null;
  }

  async findAll(): Promise<GradeLevel[]> {
    const prismaGradeLevels = await this.prisma.gradeLevel.findMany({
      orderBy: { order: "asc" },
    });
    return PrismaGradeLevelMapper.toDomainArray(prismaGradeLevels);
  }

  async findNonArchived(): Promise<GradeLevel[]> {
    const prismaGradeLevels = await this.prisma.gradeLevel.findMany({
      where: { isArchived: false },
      orderBy: { order: "asc" },
    });
    return PrismaGradeLevelMapper.toDomainArray(prismaGradeLevels);
  }

  async findAllPaginated(
    params: StandardRequest,
  ): Promise<PaginatedResult<GradeLevel>> {
    params.allowedFilterFields = ["name", "order", "isArchived"];
    params.allowedSortFields = ["name", "order", "createdAt", "updatedAt"];

    return await this.queryService.executeQuery<GradeLevel>(
      this.prisma,
      "gradeLevel",
      params,
      {
        orderBy: { order: "asc" },
      },
      PrismaGradeLevelMapper,
    );
  }

  async findAllWithClasses(
    params: StandardRequest,
  ): Promise<PaginatedResult<GradeLevel>> {
    // Define allowed fields for filtering and sorting
    params.allowedFilterFields = ["name", "order", "isArchived"];
    params.allowedSortFields = ["name", "order", "createdAt", "updatedAt"];

    // Create a mapper wrapper that uses toDomainWithClasses
    const mapperWithClasses = {
      toDomain: (item: any) => PrismaGradeLevelMapper.toDomainWithClasses(item),
    };

    return await this.queryService.executeQuery<GradeLevel>(
      this.prisma,
      "gradeLevel",
      params,
      {
        include: { classes: true },
        orderBy: { order: "asc" }, // Default sort: by order
      },
      mapperWithClasses,
    );
  }

  async findNonArchivedWithClasses(): Promise<GradeLevel[]> {
    const prismaGradeLevels = await this.prisma.gradeLevel.findMany({
      where: { isArchived: false },
      orderBy: { order: "asc" },
      include: {
        classes: true,
      },
    });
    return PrismaGradeLevelMapper.toDomainArrayWithClasses(prismaGradeLevels);
  }

  async save(gradeLevel: GradeLevel): Promise<GradeLevel> {
    const prismaData = PrismaGradeLevelMapper.toPrisma(gradeLevel);
    const created = await this.prisma.gradeLevel.create({
      data: prismaData,
    });
    return PrismaGradeLevelMapper.toDomain(created);
  }

  async update(gradeLevel: GradeLevel): Promise<GradeLevel> {
    const prismaData = PrismaGradeLevelMapper.toPrismaUpdate(gradeLevel);
    const updated = await this.prisma.gradeLevel.update({
      where: { id: gradeLevel.id },
      data: prismaData,
    });
    return PrismaGradeLevelMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.gradeLevel.delete({
      where: { id },
    });
  }

  async archive(id: string): Promise<GradeLevel> {
    const updated = await this.prisma.gradeLevel.update({
      where: { id },
      data: { isArchived: true },
    });
    return PrismaGradeLevelMapper.toDomain(updated);
  }

  async unarchive(id: string): Promise<GradeLevel> {
    const updated = await this.prisma.gradeLevel.update({
      where: { id },
      data: { isArchived: false },
    });
    return PrismaGradeLevelMapper.toDomain(updated);
  }

  async getMaxOrder(): Promise<number> {
    const result = await this.prisma.gradeLevel.aggregate({
      _max: { order: true },
    });
    return result._max.order ?? 0;
  }

  async reorder(ids: string[]): Promise<GradeLevel[]> {
    // Two-phase update to avoid unique constraint violation on 'order' field
    // Phase 1: Set all orders to negative temporary values (avoids collision)
    // Phase 2: Set all orders to final positive values
    await this.prisma.$transaction([
      // Phase 1: Temporarily set to negative values
      // Negative values won't conflict with existing positive orders
      ...ids.map((id, index) =>
        this.prisma.gradeLevel.update({
          where: { id },
          data: { order: -(index + 1) },
        }),
      ),
      // Phase 2: Set to final positive values
      ...ids.map((id, index) =>
        this.prisma.gradeLevel.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    ]);

    // Fetch and return updated grade levels sorted by order
    const updated = await this.prisma.gradeLevel.findMany({
      where: { id: { in: ids } },
      orderBy: { order: "asc" },
    });

    return PrismaGradeLevelMapper.toDomainArray(updated);
  }
}
