import {
  MealMenuRepository,
  MealMenuNaturalKey,
  MealMenuFindManyOptions,
} from "@/application/meal-menu";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { MealMenu } from "@/domain/meal-menu";
import { Injectable } from "@nestjs/common";
import { PrismaMealMenuMapper } from "../mapper/prisma-meal-menu.mapper";
import { PrismaService } from "../prisma.service";

const MEAL_MENU_INCLUDE = {
  entries: {
    orderBy: [{ dayOfWeek: "asc" as const }, { slot: "asc" as const }],
  },
  gradeLevel: true,
  class: true,
};

@Injectable()
export class PrismaMealMenuRepository implements MealMenuRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<MealMenu | null> {
    const row = await this.prisma.mealMenu.findUnique({
      where: { id },
      include: MEAL_MENU_INCLUDE,
    });
    return row ? PrismaMealMenuMapper.toDomain(row) : null;
  }

  async findByIdInCampus(
    campusId: string,
    id: string,
  ): Promise<MealMenu | null> {
    const row = await this.prisma.mealMenu.findFirst({
      where: { id, campusId },
      include: MEAL_MENU_INCLUDE,
    });
    return row ? PrismaMealMenuMapper.toDomain(row) : null;
  }

  async findByCampusId(
    campusId: string,
    params: StandardRequest,
    options: MealMenuFindManyOptions = {},
  ): Promise<PaginatedResult<MealMenu>> {
    params.allowedFilterFields = [
      "weekStartDate",
      "isArchived",
      "createdAt",
      "updatedAt",
    ];
    params.allowedSortFields = ["weekStartDate", "createdAt", "updatedAt"];

    const scope = {
      ...(options.scope ?? {}),
      campusId,
      ...(options.includeArchived ? {} : { isArchived: false }),
    };

    return this.queryService.executeQuery<MealMenu>(
      this.prisma,
      "mealMenu",
      params,
      {
        dateFilterFields: ["weekStartDate", "createdAt", "updatedAt"],
        include: MEAL_MENU_INCLUDE,
        orderBy: { weekStartDate: "desc" },
        scope,
      },
      PrismaMealMenuMapper,
    );
  }

  async findActiveByNaturalKey(
    key: MealMenuNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<MealMenu | null> {
    return this.findByNaturalKey(key, { isArchived: false }, excludeId, tx);
  }

  async findAnyByNaturalKey(
    key: MealMenuNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<MealMenu | null> {
    return this.findByNaturalKey(key, {}, excludeId, tx);
  }

  async save(mealMenu: MealMenu, tx?: AppTransactionClient): Promise<MealMenu> {
    const client = tx ?? this.prisma;
    const created = await client.mealMenu.create({
      data: {
        ...PrismaMealMenuMapper.toPrisma(mealMenu),
        entries: {
          create: mealMenu.entries.map((entry) =>
            PrismaMealMenuMapper.toPrismaEntryCreate(entry),
          ),
        },
      },
      include: MEAL_MENU_INCLUDE,
    });
    return PrismaMealMenuMapper.toDomain(created);
  }

  async update(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu> {
    const client = tx ?? this.prisma;
    const updated = await client.mealMenu.update({
      where: { id: mealMenu.id },
      data: {
        ...PrismaMealMenuMapper.toPrismaUpdate(mealMenu),
        entries: {
          deleteMany: {},
          create: mealMenu.entries.map((entry) =>
            PrismaMealMenuMapper.toPrismaEntryCreate(entry),
          ),
        },
      },
      include: MEAL_MENU_INCLUDE,
    });
    return PrismaMealMenuMapper.toDomain(updated);
  }

  async archive(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu> {
    const client = tx ?? this.prisma;
    const archived = await client.mealMenu.update({
      where: { id: mealMenu.id },
      data: { isArchived: true, updatedAt: mealMenu.updatedAt },
      include: MEAL_MENU_INCLUDE,
    });
    return PrismaMealMenuMapper.toDomain(archived);
  }

  async restore(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu> {
    const client = tx ?? this.prisma;
    const restored = await client.mealMenu.update({
      where: { id: mealMenu.id },
      data: { isArchived: false, updatedAt: mealMenu.updatedAt },
      include: MEAL_MENU_INCLUDE,
    });
    return PrismaMealMenuMapper.toDomain(restored);
  }

  private async findByNaturalKey(
    key: MealMenuNaturalKey,
    extraWhere: Record<string, unknown>,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<MealMenu | null> {
    const client = tx ?? this.prisma;
    const row = await client.mealMenu.findFirst({
      where: {
        campusId: key.campusId,
        ...this.buildTargetWhere(key),
        weekStartDate: key.weekStartDate,
        ...extraWhere,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      include: MEAL_MENU_INCLUDE,
    });
    return row ? PrismaMealMenuMapper.toDomain(row) : null;
  }

  private buildTargetWhere(key: MealMenuNaturalKey): Record<string, unknown> {
    switch (key.targetType) {
      case "campus":
        return { targetType: "campus", gradeLevelId: null, classId: null };
      case "grade":
        return {
          targetType: "grade",
          gradeLevelId: key.gradeLevelId,
          classId: null,
        };
      case "class":
        return {
          targetType: "class",
          gradeLevelId: null,
          classId: key.classId,
        };
    }
  }
}
