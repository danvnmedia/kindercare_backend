import { WeeklyPlan } from "@/domain/weekly-plan";
import { PrismaWeeklyPlanMapper } from "../../mapper";
import { PrismaTransactionClient } from "./base.transaction-ops";

/**
 * Weekly-plan transaction operations.
 *
 * Mirrors repository write semantics while binding every write to the active
 * Prisma transaction client so mutation and audit records can commit together.
 */
export class WeeklyPlanTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  async createWeeklyPlan(weeklyPlan: WeeklyPlan): Promise<WeeklyPlan> {
    const created = await this.tx.weeklyPlan.create({
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

  async updateWeeklyPlan(weeklyPlan: WeeklyPlan): Promise<WeeklyPlan> {
    const updated = await this.tx.weeklyPlan.update({
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

  async archiveWeeklyPlan(weeklyPlan: WeeklyPlan): Promise<WeeklyPlan> {
    const archived = await this.tx.weeklyPlan.update({
      where: { id: weeklyPlan.id },
      data: { isArchived: true, updatedAt: weeklyPlan.updatedAt },
      include: PrismaWeeklyPlanMapper.include,
    });

    return PrismaWeeklyPlanMapper.toDomain(archived);
  }

  async restoreWeeklyPlan(weeklyPlan: WeeklyPlan): Promise<WeeklyPlan> {
    const restored = await this.tx.weeklyPlan.update({
      where: { id: weeklyPlan.id },
      data: { isArchived: false, updatedAt: weeklyPlan.updatedAt },
      include: PrismaWeeklyPlanMapper.include,
    });

    return PrismaWeeklyPlanMapper.toDomain(restored);
  }
}
