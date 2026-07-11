import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  PostCategory,
  UpdatePostCategoryData,
} from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import {
  isUniqueConstraintError,
  normalizePostCategoryFields,
} from "./post-category-validation";

export interface UpdatePostCategoryInput {
  campusId: string;
  name?: string;
  color?: string;
  icon?: string | null;
  order?: number;
}

@Injectable()
export class UpdatePostCategoryUseCase {
  private readonly logger = new Logger(UpdatePostCategoryUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    id: string,
    input: UpdatePostCategoryInput,
    currentUser: User,
  ): Promise<PostCategory> {
    let normalizedInput: UpdatePostCategoryInput;
    try {
      normalizedInput = normalizePostCategoryFields(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid post category",
      );
    }
    this.logger.log(`Updating post category: ${id}`);

    try {
      const updatedCategory = await this.unitOfWork.run(async (tx) => {
        await tx.lockPostCategoryCampus(normalizedInput.campusId);
        const category = await tx.findPostCategoryByIdForUpdate(id);
        if (!category) {
          throw new NotFoundException(`Post category with ID ${id} not found`);
        }
        if (category.campusId !== normalizedInput.campusId) {
          throw new ForbiddenException(
            "You do not have access to this category in the specified campus",
          );
        }

        const active = await tx.findActivePostCategoriesForUpdate(
          normalizedInput.campusId,
        );
        if (normalizedInput.order !== undefined) {
          if (category.isArchived) {
            throw new BadRequestException(
              "Archived post categories cannot be reordered",
            );
          }
          this.assertOrderInRange(normalizedInput.order, active.length);
        }

        if (normalizedInput.name !== undefined) {
          const duplicate = await tx.findPostCategoryByName(
            normalizedInput.campusId,
            normalizedInput.name,
          );
          if (duplicate && duplicate.id.toString() !== id) {
            throw new ConflictException(
              `Category "${normalizedInput.name}" already exists in this campus`,
            );
          }
        }

        const beforeValue = this.toAuditSnapshot(category);
        const updateData: UpdatePostCategoryData = {};
        if (normalizedInput.name !== undefined) {
          updateData.name = normalizedInput.name;
        }
        if (normalizedInput.color !== undefined) {
          updateData.color = normalizedInput.color;
        }
        if (normalizedInput.icon !== undefined) {
          updateData.icon = normalizedInput.icon;
        }
        category.updateInfo(updateData);
        let saved = await tx.updatePostCategory(category);

        if (
          normalizedInput.order !== undefined &&
          normalizedInput.order !== category.order
        ) {
          const ids = active
            .map((item) => item.id.toString())
            .filter((categoryId) => categoryId !== id);
          ids.splice(normalizedInput.order - 1, 0, id);
          const reordered = await tx.reorderPostCategories(
            normalizedInput.campusId,
            ids,
          );
          saved = reordered.find((item) => item.id.toString() === id) ?? saved;
        }

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_POST_CATEGORY",
          targetType: "post_category",
          targetId: saved.id.toString(),
          campusId: normalizedInput.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.name,
          },
          beforeValue,
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });

      this.logger.log(`Post category updated successfully: ${id}`);
      return updatedCategory;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Category "${normalizedInput.name ?? ""}" already exists in this campus`,
        );
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : "Failed to update category",
      );
    }
  }

  private assertOrderInRange(order: number, maximum: number): void {
    if (!Number.isInteger(order) || order < 1 || order > maximum) {
      throw new BadRequestException(
        `Category order must be an integer between 1 and ${maximum}`,
      );
    }
  }

  private toAuditSnapshot(category: PostCategory): Record<string, unknown> {
    return {
      name: category.name,
      color: category.color,
      icon: category.icon,
      order: category.order,
      isArchived: category.isArchived,
    };
  }
}
