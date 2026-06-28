import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { MealMenu, MealMenuTargetIdentity } from "@/domain/meal-menu";

export type MealMenuNaturalKey = MealMenuTargetIdentity & {
  campusId: string;
  weekStartDate: Date;
};

export interface MealMenuFindManyOptions {
  includeArchived?: boolean;
  scope?: Record<string, unknown>;
}

export abstract class MealMenuRepository {
  abstract findById(id: string): Promise<MealMenu | null>;

  abstract findByIdInCampus(
    campusId: string,
    id: string,
  ): Promise<MealMenu | null>;

  abstract findByCampusId(
    campusId: string,
    params: StandardRequest,
    options?: MealMenuFindManyOptions,
  ): Promise<PaginatedResult<MealMenu>>;

  abstract findActiveByNaturalKey(
    key: MealMenuNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<MealMenu | null>;

  abstract findAnyByNaturalKey(
    key: MealMenuNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<MealMenu | null>;

  abstract save(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu>;

  abstract update(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu>;

  abstract archive(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu>;

  abstract restore(
    mealMenu: MealMenu,
    tx?: AppTransactionClient,
  ): Promise<MealMenu>;
}
