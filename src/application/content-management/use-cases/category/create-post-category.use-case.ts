import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { PostCategory } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import {
  isUniqueConstraintError,
  normalizePostCategoryFields,
} from "./post-category-validation";

export interface CreatePostCategoryInput {
  campusId: string;
  name: string;
  color: string;
  icon?: string | null;
  order?: number;
}

@Injectable()
export class CreatePostCategoryUseCase {
  private readonly logger = new Logger(CreatePostCategoryUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    input: CreatePostCategoryInput,
    currentUser: User,
  ): Promise<PostCategory> {
    let normalizedInput: CreatePostCategoryInput;
    try {
      normalizedInput = normalizePostCategoryFields(input);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid post category",
      );
    }
    this.logger.log(`Creating post category: ${normalizedInput.name}`);

    try {
      const savedCategory = await this.unitOfWork.run(async (tx) => {
        await tx.lockPostCategoryCampus(normalizedInput.campusId);
        const active = await tx.findActivePostCategoriesForUpdate(
          normalizedInput.campusId,
        );
        const insertionOrder = normalizedInput.order ?? active.length + 1;
        this.assertOrderInRange(insertionOrder, active.length + 1);

        const duplicate = await tx.findPostCategoryByName(
          normalizedInput.campusId,
          normalizedInput.name,
        );
        if (duplicate) {
          throw new ConflictException(
            `Category "${normalizedInput.name}" already exists in this campus`,
          );
        }

        const category = PostCategory.create({
          campusId: normalizedInput.campusId,
          name: normalizedInput.name,
          color: normalizedInput.color,
          icon: normalizedInput.icon ?? null,
          order: active.length + 1,
        });
        let saved = await tx.createPostCategory(category);

        if (insertionOrder !== active.length + 1) {
          const ids = active.map((item) => item.id.toString());
          ids.splice(insertionOrder - 1, 0, saved.id.toString());
          const reordered = await tx.reorderPostCategories(
            normalizedInput.campusId,
            ids,
          );
          saved =
            reordered.find(
              (item) => item.id.toString() === saved.id.toString(),
            ) ?? saved;
        }

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_POST_CATEGORY",
          targetType: "post_category",
          targetId: saved.id.toString(),
          campusId: normalizedInput.campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.name,
          },
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });

      this.logger.log(`Post category created: ${savedCategory.id}`);
      return savedCategory;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Category "${normalizedInput.name}" already exists in this campus`,
        );
      }
      throw new BadRequestException(
        error instanceof Error ? error.message : "Failed to create category",
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
