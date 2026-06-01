import { MealMenu, MealMenuConfig } from "@/domain/meal-menu";
import { PrismaMealMenuConfigMapper, PrismaMealMenuMapper } from "../../mapper";
import { PrismaTransactionClient } from "./base.transaction-ops";

const MEAL_MENU_INCLUDE = {
  entries: {
    orderBy: [{ dayOfWeek: "asc" as const }, { slot: "asc" as const }],
  },
  gradeLevel: true,
};

/**
 * Meal-menu transaction operations.
 *
 * Mirrors the repository write semantics, but binds every write to the active
 * Prisma transaction client so the mutation and `tx.recordAudit(...)` commit or
 * roll back together.
 */
export class MealMenuTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  async createMealMenu(mealMenu: MealMenu): Promise<MealMenu> {
    const created = await this.tx.mealMenu.create({
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

  async updateMealMenu(mealMenu: MealMenu): Promise<MealMenu> {
    const updated = await this.tx.mealMenu.update({
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

  async archiveMealMenu(mealMenu: MealMenu): Promise<MealMenu> {
    const archived = await this.tx.mealMenu.update({
      where: { id: mealMenu.id },
      data: { isArchived: true, updatedAt: mealMenu.updatedAt },
      include: MEAL_MENU_INCLUDE,
    });

    return PrismaMealMenuMapper.toDomain(archived);
  }

  async restoreMealMenu(mealMenu: MealMenu): Promise<MealMenu> {
    const restored = await this.tx.mealMenu.update({
      where: { id: mealMenu.id },
      data: { isArchived: false, updatedAt: mealMenu.updatedAt },
      include: MEAL_MENU_INCLUDE,
    });

    return PrismaMealMenuMapper.toDomain(restored);
  }

  async upsertMealMenuConfig(config: MealMenuConfig): Promise<MealMenuConfig> {
    const upserted = await this.tx.mealMenuConfig.upsert({
      where: { campusId: config.campusId },
      create: PrismaMealMenuConfigMapper.toPrisma(config),
      update: PrismaMealMenuConfigMapper.toPrismaUpdate(config),
    });

    return PrismaMealMenuConfigMapper.toDomain(upserted);
  }
}
