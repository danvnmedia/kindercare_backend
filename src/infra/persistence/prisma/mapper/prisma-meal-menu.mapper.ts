import {
  GradeLevel as PrismaGradeLevel,
  MealMenu as PrismaMealMenu,
  MealMenuEntry as PrismaMealMenuEntry,
  Prisma,
} from "@prisma/client";
import { MealMenu, MealMenuEntry } from "@/domain/meal-menu";

type PrismaMealMenuWithRelations = PrismaMealMenu & {
  entries?: PrismaMealMenuEntry[];
  gradeLevel?: PrismaGradeLevel | null;
};

export class PrismaMealMenuMapper {
  static toDomain(row: PrismaMealMenuWithRelations): MealMenu {
    return MealMenu.create(
      {
        campusId: row.campusId,
        gradeLevelId: row.gradeLevelId,
        gradeLevel: row.gradeLevel
          ? { id: row.gradeLevel.id, name: row.gradeLevel.name }
          : null,
        weekStartDate: row.weekStartDate,
        title: row.title,
        days: row.days,
        mealSlots: row.mealSlots,
        entries: (row.entries ?? []).map((entry) => ({
          dayOfWeek: entry.dayOfWeek,
          slot: entry.slot,
          description: entry.description,
        })),
        isArchived: row.isArchived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toDomainSimple(row: PrismaMealMenu): MealMenu {
    return MealMenu.create(
      {
        campusId: row.campusId,
        gradeLevelId: row.gradeLevelId,
        weekStartDate: row.weekStartDate,
        title: row.title,
        days: row.days,
        mealSlots: row.mealSlots,
        entries: [],
        isArchived: row.isArchived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrisma(menu: MealMenu): Prisma.MealMenuUncheckedCreateInput {
    return {
      id: menu.id,
      campusId: menu.campusId,
      gradeLevelId: menu.gradeLevelId,
      weekStartDate: menu.weekStartDate,
      title: menu.title,
      days: menu.days,
      mealSlots: menu.mealSlots,
      isArchived: menu.isArchived,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
    };
  }

  static toPrismaUpdate(menu: MealMenu): Prisma.MealMenuUncheckedUpdateInput {
    return {
      gradeLevelId: menu.gradeLevelId,
      weekStartDate: menu.weekStartDate,
      title: menu.title,
      days: menu.days,
      mealSlots: menu.mealSlots,
      isArchived: menu.isArchived,
      updatedAt: menu.updatedAt,
    };
  }

  static toPrismaEntryCreate(
    entry: MealMenuEntry,
  ): Prisma.MealMenuEntryCreateWithoutMealMenuInput {
    return {
      dayOfWeek: entry.dayOfWeek,
      slot: entry.slot,
      description: entry.description,
    };
  }

  static toDomainArray(rows: PrismaMealMenuWithRelations[]): MealMenu[] {
    return rows.map((row) => PrismaMealMenuMapper.toDomain(row));
  }
}
