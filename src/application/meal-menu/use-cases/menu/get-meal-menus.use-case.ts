import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { MealMenuRepository } from "@/application/meal-menu/ports";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { MealMenu } from "@/domain/meal-menu";

export type MealMenuListTarget = "all" | "campus" | "grade";

export interface GetMealMenusInput {
  campusId: string;
  params: StandardRequest;
  target?: MealMenuListTarget;
  gradeLevelId?: string;
}

@Injectable()
export class GetMealMenusUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
  ) {}

  async execute(input: GetMealMenusInput): Promise<PaginatedResult<MealMenu>> {
    const target = input.target ?? "all";
    const scope = await this.buildTargetScope(
      input.campusId,
      target,
      input.gradeLevelId,
    );

    return this.mealMenuRepository.findByCampusId(
      input.campusId,
      input.params,
      {
        includeArchived: this.hasIsArchivedFilter(input.params),
        scope,
      },
    );
  }

  private async buildTargetScope(
    campusId: string,
    target: MealMenuListTarget,
    gradeLevelId?: string,
  ): Promise<Record<string, unknown>> {
    if (target === "campus") {
      if (gradeLevelId) {
        throw new BadRequestException(
          "gradeLevelId is only supported when target=grade",
        );
      }

      return { gradeLevelId: null };
    }

    if (target === "grade") {
      if (!gradeLevelId) {
        throw new BadRequestException(
          "gradeLevelId is required when target=grade",
        );
      }

      await this.ensureGradeLevelBelongsToCampus(campusId, gradeLevelId);
      return { gradeLevelId };
    }

    if (target !== "all") {
      throw new BadRequestException("target must be one of all, campus, grade");
    }

    if (gradeLevelId) {
      throw new BadRequestException(
        "gradeLevelId is only supported when target=grade",
      );
    }

    return {};
  }

  private async ensureGradeLevelBelongsToCampus(
    campusId: string,
    gradeLevelId: string,
  ): Promise<void> {
    const gradeLevel = await this.gradeLevelRepository.findById(gradeLevelId);

    if (!gradeLevel || gradeLevel.campusId !== campusId) {
      throw new NotFoundException(
        `Grade level with ID ${gradeLevelId} not found`,
      );
    }
  }

  private hasIsArchivedFilter(params: StandardRequest): boolean {
    const filters = params.filterInfo?.filters;
    if (
      filters &&
      Object.prototype.hasOwnProperty.call(filters, "isArchived")
    ) {
      return true;
    }

    if (typeof params.filter !== "string") {
      return false;
    }

    try {
      const parsedFilter = JSON.parse(params.filter) as Record<string, unknown>;
      return Object.prototype.hasOwnProperty.call(parsedFilter, "isArchived");
    } catch {
      return false;
    }
  }
}
