import { MealMenuConfigRepository } from "@/application/meal-menu";
import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { MealMenuConfig } from "@/domain/meal-menu";
import { Injectable } from "@nestjs/common";
import { PrismaMealMenuConfigMapper } from "../mapper/prisma-meal-menu-config.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaMealMenuConfigRepository
  implements MealMenuConfigRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findByCampusId(campusId: string): Promise<MealMenuConfig | null> {
    const row = await this.prisma.mealMenuConfig.findUnique({
      where: { campusId },
    });
    return row ? PrismaMealMenuConfigMapper.toDomain(row) : null;
  }

  async save(
    config: MealMenuConfig,
    tx?: AppTransactionClient,
  ): Promise<MealMenuConfig> {
    const client = tx ?? this.prisma;
    const created = await client.mealMenuConfig.create({
      data: PrismaMealMenuConfigMapper.toPrisma(config),
    });
    return PrismaMealMenuConfigMapper.toDomain(created);
  }

  async update(
    config: MealMenuConfig,
    tx?: AppTransactionClient,
  ): Promise<MealMenuConfig> {
    const client = tx ?? this.prisma;
    const updated = await client.mealMenuConfig.update({
      where: { id: config.id },
      data: PrismaMealMenuConfigMapper.toPrismaUpdate(config),
    });
    return PrismaMealMenuConfigMapper.toDomain(updated);
  }

  async upsert(
    config: MealMenuConfig,
    tx?: AppTransactionClient,
  ): Promise<MealMenuConfig> {
    const client = tx ?? this.prisma;
    const upserted = await client.mealMenuConfig.upsert({
      where: { campusId: config.campusId },
      create: PrismaMealMenuConfigMapper.toPrisma(config),
      update: PrismaMealMenuConfigMapper.toPrismaUpdate(config),
    });
    return PrismaMealMenuConfigMapper.toDomain(upserted);
  }
}
