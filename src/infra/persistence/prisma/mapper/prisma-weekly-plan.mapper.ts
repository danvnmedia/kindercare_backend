import {
  Class as PrismaClass,
  GradeLevel as PrismaGradeLevel,
  Prisma,
  SchoolYear as PrismaSchoolYear,
  WeeklyPlan as PrismaWeeklyPlan,
  WeeklyPlanActivity as PrismaWeeklyPlanActivity,
  WeeklyPlanBlock as PrismaWeeklyPlanBlock,
} from "@prisma/client";
import { WeeklyPlan, WeeklyPlanBlock } from "@/domain/weekly-plan";

type PrismaWeeklyPlanClass = PrismaClass & {
  gradeLevel?: PrismaGradeLevel | null;
  schoolYear?: PrismaSchoolYear | null;
};

type PrismaWeeklyPlanBlockWithActivities = PrismaWeeklyPlanBlock & {
  activities?: PrismaWeeklyPlanActivity[];
};

type PrismaWeeklyPlanWithRelations = PrismaWeeklyPlan & {
  class?: PrismaWeeklyPlanClass | null;
  blocks?: PrismaWeeklyPlanBlockWithActivities[];
};

export class PrismaWeeklyPlanMapper {
  static include = {
    class: {
      include: {
        gradeLevel: true,
        schoolYear: true,
      },
    },
    blocks: {
      orderBy: [
        { dayOfWeek: "asc" as const },
        { startMinute: "asc" as const },
        { order: "asc" as const },
      ],
      include: {
        activities: {
          orderBy: { order: "asc" as const },
        },
      },
    },
  };

  static toDomain(row: PrismaWeeklyPlanWithRelations): WeeklyPlan {
    return WeeklyPlan.create(
      {
        campusId: row.campusId,
        classId: row.classId,
        classroom: row.class
          ? {
              id: row.class.id,
              name: row.class.name,
              gradeLevelId: row.class.gradeLevelId,
              gradeLevelName: row.class.gradeLevel?.name ?? null,
              schoolYearId: row.class.schoolYearId,
              schoolYearName: row.class.schoolYear?.name ?? null,
            }
          : null,
        weekStartDate: row.weekStartDate,
        theme: row.theme,
        blocks: (row.blocks ?? []).map((block) => ({
          dayOfWeek: block.dayOfWeek,
          startMinute: block.startMinute,
          endMinute: block.endMinute,
          order: block.order,
          activities: (block.activities ?? []).map((activity) => ({
            order: activity.order,
            title: activity.title,
            description: activity.description,
          })),
        })),
        isArchived: row.isArchived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      row.id,
    );
  }

  static toPrisma(plan: WeeklyPlan): Prisma.WeeklyPlanUncheckedCreateInput {
    return {
      id: plan.id,
      campusId: plan.campusId,
      classId: plan.classId,
      weekStartDate: plan.weekStartDate,
      theme: plan.theme,
      isArchived: plan.isArchived,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  static toPrismaUpdate(
    plan: WeeklyPlan,
  ): Prisma.WeeklyPlanUncheckedUpdateInput {
    return {
      classId: plan.classId,
      weekStartDate: plan.weekStartDate,
      theme: plan.theme,
      isArchived: plan.isArchived,
      updatedAt: plan.updatedAt,
    };
  }

  static toPrismaBlockCreate(
    block: WeeklyPlanBlock,
  ): Prisma.WeeklyPlanBlockCreateWithoutWeeklyPlanInput {
    return {
      dayOfWeek: block.dayOfWeek,
      startMinute: block.startMinute,
      endMinute: block.endMinute,
      order: block.order,
      activities: {
        create: block.activities.map((activity) => ({
          order: activity.order,
          title: activity.title,
          description: activity.description,
        })),
      },
    };
  }

  static toDomainArray(rows: PrismaWeeklyPlanWithRelations[]): WeeklyPlan[] {
    return rows.map((row) => PrismaWeeklyPlanMapper.toDomain(row));
  }
}
