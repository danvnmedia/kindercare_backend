import {
  Class as PrismaClass,
  GradeLevel as PrismaGradeLevel,
  MealMenu as PrismaMealMenu,
  MealMenuEntry as PrismaMealMenuEntry,
  Prisma,
} from "@prisma/client";
import {
  MealMenu,
  MealMenuEntry,
  MealMenuTargetType,
} from "@/domain/meal-menu";

type PrismaMealMenuWithRelations = PrismaMealMenu & {
  entries?: PrismaMealMenuEntry[];
  gradeLevel?: PrismaGradeLevel | null;
  class?: PrismaClass | null;
};

export class PrismaMealMenuMapper {
  static toDomain(row: PrismaMealMenuWithRelations): MealMenu {
    return MealMenu.create(
      {
        campusId: row.campusId,
        targetType: row.targetType as MealMenuTargetType,
        gradeLevelId: row.gradeLevelId,
        classId: row.classId,
        gradeLevel: row.gradeLevel
          ? { id: row.gradeLevel.id, name: row.gradeLevel.name }
          : null,
        classroom: row.class
          ? {
              id: row.class.id,
              name: row.class.name,
              gradeLevelId: row.class.gradeLevelId,
            }
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
        targetType: row.targetType as MealMenuTargetType,
        gradeLevelId: row.gradeLevelId,
        classId: row.classId,
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
      targetType: menu.targetType,
      gradeLevelId: menu.gradeLevelId,
      classId: menu.classId,
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
      targetType: menu.targetType,
      gradeLevelId: menu.gradeLevelId,
      classId: menu.classId,
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
