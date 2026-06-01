import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { GradeLevelRepository } from "@/application/class-management/ports/grade-level.repository";
import { MealMenuRepository } from "@/application/meal-menu/ports";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { MealMenu, MealMenuGradeLevelSnapshot } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  buildMealMenuAuditContext,
  buildMealMenuAuditSnapshot,
  getMealMenuAuditActorId,
} from "../meal-menu-audit";

export interface CopyMealMenuInput {
  campusId: string;
  weekStartDate: Date;
  gradeLevelId?: string | null;
  title?: string | null;
}

const COPY_CONFLICT_MESSAGE =
  "An active meal menu already exists for this campus, target, and week";

@Injectable()
export class CopyMealMenuUseCase {
  constructor(
    @Inject("MEAL_MENU_REPOSITORY")
    private readonly mealMenuRepository: MealMenuRepository,
    @Inject("GRADE_LEVEL_REPOSITORY")
    private readonly gradeLevelRepository: GradeLevelRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    sourceId: string,
    input: CopyMealMenuInput,
    currentUser?: User,
  ): Promise<MealMenu> {
    if (input.gradeLevelId === undefined) {
      throw new BadRequestException(
        "gradeLevelId is required for copy destination",
      );
    }

    const source = await this.mealMenuRepository.findByIdInCampus(
      input.campusId,
      sourceId,
    );

    if (!source) {
      throw new NotFoundException(`Meal menu with ID ${sourceId} not found`);
    }

    if (source.isArchived) {
      throw new BadRequestException("Archived meal menus cannot be copied");
    }

    const gradeLevelId = input.gradeLevelId;
    const gradeLevel = await this.resolveGradeLevelSnapshot(
      input.campusId,
      gradeLevelId,
    );

    let copy: MealMenu;
    try {
      copy = MealMenu.create({
        campusId: input.campusId,
        gradeLevelId,
        gradeLevel,
        weekStartDate: input.weekStartDate,
        title: input.title === undefined ? source.title : input.title,
        days: source.days,
        mealSlots: source.mealSlots,
        entries: source.entries,
      });
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid meal menu copy",
      );
    }

    const existing = await this.mealMenuRepository.findActiveByNaturalKey({
      campusId: copy.campusId,
      gradeLevelId: copy.gradeLevelId,
      weekStartDate: copy.weekStartDate,
    });
    if (existing) {
      throw new ConflictException(COPY_CONFLICT_MESSAGE);
    }

    try {
      return await this.unitOfWork.run(async (tx) => {
        const saved = await tx.createMealMenu(copy);
        await tx.recordAudit({
          actorId: getMealMenuAuditActorId(currentUser),
          action: "COPY_MEAL_MENU",
          targetType: "meal_menu",
          targetId: saved.id,
          campusId: saved.campusId,
          context: buildMealMenuAuditContext(saved, currentUser, {
            sourceMealMenuId: source.id,
            sourceWeekStartDate: source.weekStartDate.toISOString(),
            sourceGradeLevelId: source.gradeLevelId,
          }),
          afterValue: buildMealMenuAuditSnapshot(saved),
        });
        return saved;
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(COPY_CONFLICT_MESSAGE);
      }
      throw error;
    }
  }

  private async resolveGradeLevelSnapshot(
    campusId: string,
    gradeLevelId: string | null,
  ): Promise<MealMenuGradeLevelSnapshot | null> {
    if (gradeLevelId === null) {
      return null;
    }

    const gradeLevel = await this.gradeLevelRepository.findById(gradeLevelId);
    if (!gradeLevel || gradeLevel.campusId !== campusId) {
      throw new NotFoundException(
        `Grade level with ID ${gradeLevelId} not found`,
      );
    }

    return {
      id: gradeLevel.id,
      name: gradeLevel.name,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }
}
