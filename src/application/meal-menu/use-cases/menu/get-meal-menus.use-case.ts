import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { ClassRepository } from "@/application/class-management/ports/class.repository";
import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { MealMenuRepository } from "@/application/meal-menu/ports";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { MealMenu } from "@/domain/meal-menu";

export type MealMenuListTarget = "all" | "campus" | "grade" | "class";

export interface GetMealMenusInput {
  campusId: string;
  params: StandardRequest;
  target?: MealMenuListTarget;
  gradeLevelId?: string;
  classId?: string;
}

@Injectable()
export class GetMealMenusUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    @Inject("CLASS_REPOSITORY")
    private readonly classRepository: ClassRepository,
  ) {}

  async execute(input: GetMealMenusInput): Promise<PaginatedResult<MealMenu>> {
    const target = input.target ?? "all";
    const scope = await this.buildTargetScope(
      input.campusId,
      target,
      input.gradeLevelId,
      input.classId,
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
    classId?: string,
  ): Promise<Record<string, unknown>> {
    if (target === "campus") {
      if (gradeLevelId !== undefined || classId !== undefined) {
        throw new BadRequestException(
          "Target ids are not supported when target=campus",
        );
      }

      return { targetType: "campus", gradeLevelId: null, classId: null };
    }

    if (target === "grade") {
      if (classId !== undefined) {
        throw new BadRequestException(
          "classId is only supported when target=class",
        );
      }

      if (!gradeLevelId) {
        throw new BadRequestException(
          "gradeLevelId is required when target=grade",
        );
      }

      await this.ensureGradeLevelBelongsToCampus(campusId, gradeLevelId);
      return { targetType: "grade", gradeLevelId, classId: null };
    }

    if (target === "class") {
      if (gradeLevelId !== undefined) {
        throw new BadRequestException(
          "gradeLevelId is only supported when target=grade",
        );
      }

      if (!classId) {
        throw new BadRequestException("classId is required when target=class");
      }

      await this.ensureClassBelongsToCampus(campusId, classId);
      return { targetType: "class", gradeLevelId: null, classId };
    }

    if (target !== "all") {
      throw new BadRequestException(
        "target must be one of all, campus, grade, class",
      );
    }

    if (gradeLevelId !== undefined || classId !== undefined) {
      throw new BadRequestException(
        "Target ids require target=grade or target=class",
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

  private async ensureClassBelongsToCampus(
    campusId: string,
    classId: string,
  ): Promise<void> {
    const classroom = await this.classRepository.findById(classId);

    if (!classroom || classroom.campusId !== campusId) {
      throw new NotFoundException(`Class with ID ${classId} not found`);
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
