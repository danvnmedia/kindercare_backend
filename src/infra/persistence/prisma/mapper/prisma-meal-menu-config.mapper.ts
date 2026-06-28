import { MealMenuConfig as PrismaMealMenuConfig, Prisma } from "@prisma/client";
import { MealMenuConfig } from "@/domain/meal-menu";

export class PrismaMealMenuConfigMapper {
  static toDomain(row: PrismaMealMenuConfig): MealMenuConfig {
    return MealMenuConfig.create(
      {
        campusId: row.campusId,
        operatingDays: row.operatingDays,
        defaultMealSlots: row.defaultMealSlots,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toDomainSimple(row: PrismaMealMenuConfig): MealMenuConfig {
    return PrismaMealMenuConfigMapper.toDomain(row);
  }

  static toPrisma(
    config: MealMenuConfig,
  ): Prisma.MealMenuConfigUncheckedCreateInput {
    return {
      id: config.id,
      campusId: config.campusId,
      operatingDays: config.operatingDays,
      defaultMealSlots: config.defaultMealSlots,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  static toPrismaUpdate(
    config: MealMenuConfig,
  ): Prisma.MealMenuConfigUpdateInput {
    return {
      operatingDays: config.operatingDays,
      defaultMealSlots: config.defaultMealSlots,
      updatedAt: config.updatedAt,
    };
  }

  static toDomainArray(rows: PrismaMealMenuConfig[]): MealMenuConfig[] {
    return rows.map((row) => PrismaMealMenuConfigMapper.toDomain(row));
  }
}
