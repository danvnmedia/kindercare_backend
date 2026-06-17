import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { MealMenuConfig } from "@/domain/meal-menu";

export abstract class MealMenuConfigRepository {
  abstract findByCampusId(campusId: string): Promise<MealMenuConfig | null>;

  abstract save(
    config: MealMenuConfig,
    tx?: AppTransactionClient,
  ): Promise<MealMenuConfig>;

  abstract update(
    config: MealMenuConfig,
    tx?: AppTransactionClient,
  ): Promise<MealMenuConfig>;

  abstract upsert(
    config: MealMenuConfig,
    tx?: AppTransactionClient,
  ): Promise<MealMenuConfig>;
}
