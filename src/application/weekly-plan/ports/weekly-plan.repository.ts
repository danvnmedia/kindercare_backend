import { AppTransactionClient } from "@/application/ports/transaction-runner.port";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { WeeklyPlan } from "@/domain/weekly-plan";

export interface WeeklyPlanNaturalKey {
  campusId: string;
  classId: string;
  weekStartDate: Date;
}

export interface WeeklyPlanFindManyOptions {
  includeArchived?: boolean;
  scope?: Record<string, unknown>;
}

export abstract class WeeklyPlanRepository {
  abstract findById(id: string): Promise<WeeklyPlan | null>;

  abstract findByIdInCampus(
    campusId: string,
    id: string,
  ): Promise<WeeklyPlan | null>;

  abstract findByCampusId(
    campusId: string,
    params: StandardRequest,
    options?: WeeklyPlanFindManyOptions,
  ): Promise<PaginatedResult<WeeklyPlan>>;

  abstract findActiveByNaturalKey(
    key: WeeklyPlanNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan | null>;

  abstract findAnyByNaturalKey(
    key: WeeklyPlanNaturalKey,
    excludeId?: string,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan | null>;

  abstract save(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan>;

  abstract update(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan>;

  abstract archive(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan>;

  abstract restore(
    weeklyPlan: WeeklyPlan,
    tx?: AppTransactionClient,
  ): Promise<WeeklyPlan>;
}
