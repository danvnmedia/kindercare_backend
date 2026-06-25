import {
  WeeklyPlanFindManyOptions,
  WeeklyPlanNaturalKey,
  WeeklyPlanRepository,
} from "@/application/weekly-plan";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { WeeklyPlan } from "@/domain/weekly-plan";
import { Injectable } from "@nestjs/common";
import { PrismaWeeklyPlanMapper } from "../mapper/prisma-weekly-plan.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaWeeklyPlanRepository implements WeeklyPlanRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<WeeklyPlan | null> {
    const row = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: PrismaWeeklyPlanMapper.include,
    });
    return row ? PrismaWeeklyPlanMapper.toDomain(row) : null;
  }

  async findByIdInCampus(
    campusId: string,
    id: string,
  ): Promise<WeeklyPlan | null> {
    const row = await this.prisma.weeklyPlan.findFirst({
      where: { id, campusId },
      include: PrismaWeeklyPlanMapper.include,
    });
    return row ? PrismaWeeklyPlanMapper.toDomain(row) : null;
  }

  async findByCampusId(
    campusId: string,
    params: StandardRequest,
    options: WeeklyPlanFindManyOptions = {},
  ): Promise<PaginatedResult<WeeklyPlan>> {
    params.allowedFilterFields = [
      "classId",
      "weekStartDate",
      "isArchived",
      "createdAt",
      "updatedAt",
    ];
    params.allowedSortFields = [
      "weekStartDate",
      "createdAt",
      "updatedAt",
    ];

    const scope = {
      ...(options.scope ?? {}),
      campusId,
      ...(options.includeArchived ? {} : { isArchived: false }),
    };

    return this.queryService.executeQuery<WeeklyPlan>(
      this.prisma,
      "weeklyPlan",
      params,
      {
        include: PrismaWeeklyPlanMapper.include,
        orderBy: { weekStartDate: "desc" },
        scope,
      },
      PrismaWeeklyPlanMapper,
    );
  }

  async findActiveByNaturalKey(
    key: WeeklyPlanNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan | null> {
    return this.findByNaturalKey(key, { isArchived: false }, excludeId, tx);
  }

  async findAnyByNaturalKey(
    key: WeeklyPlanNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan | null> {
    return this.findByNaturalKey(key, {}, excludeId, tx);
  }

  async save(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan> {
    const client = tx ?? this.prisma;
    const created = await client.weeklyPlan.create({
      data: {
        ...PrismaWeeklyPlanMapper.toPrisma(weeklyPlan),
        blocks: {
          create: weeklyPlan.blocks.map((block) =>
            PrismaWeeklyPlanMapper.toPrismaBlockCreate(block),
          ),
        },
      },
      include: PrismaWeeklyPlanMapper.include,
    });
    return PrismaWeeklyPlanMapper.toDomain(created);
  }

  async update(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan> {
    const client = tx ?? this.prisma;
    const updated = await client.weeklyPlan.update({
      where: { id: weeklyPlan.id },
      data: {
        ...PrismaWeeklyPlanMapper.toPrismaUpdate(weeklyPlan),
        blocks: {
          deleteMany: {},
          create: weeklyPlan.blocks.map((block) =>
            PrismaWeeklyPlanMapper.toPrismaBlockCreate(block),
          ),
        },
      },
      include: PrismaWeeklyPlanMapper.include,
    });
    return PrismaWeeklyPlanMapper.toDomain(updated);
  }

  async archive(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan> {
    const client = tx ?? this.prisma;
    const archived = await client.weeklyPlan.update({
      where: { id: weeklyPlan.id },
      data: { isArchived: true, updatedAt: weeklyPlan.updatedAt },
      include: PrismaWeeklyPlanMapper.include,
    });
    return PrismaWeeklyPlanMapper.toDomain(archived);
  }

  async restore(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan> {
    const client = tx ?? this.prisma;
    const restored = await client.weeklyPlan.update({
      where: { id: weeklyPlan.id },
      data: { isArchived: false, updatedAt: weeklyPlan.updatedAt },
      include: PrismaWeeklyPlanMapper.include,
    });
    return PrismaWeeklyPlanMapper.toDomain(restored);
  }

  private async findByNaturalKey(
    key: WeeklyPlanNaturalKey,
    extraWhere: Record<string, unknown>,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan | null> {
    const client = tx ?? this.prisma;
    const row = await client.weeklyPlan.findFirst({
      where: {
        campusId: key.campusId,
        classId: key.classId,
        weekStartDate: key.weekStartDate,
        ...extraWhere,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: PrismaWeeklyPlanMapper.include,
    });
    return row ? PrismaWeeklyPlanMapper.toDomain(row) : null;
  }
}
