import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from "@nestjs/common";
import {
  PostCategory,
  UpdatePostCategoryData,
} from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";

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

  constructor(
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    id: string,
    input: UpdatePostCategoryInput,
    currentUser: User,
  ): Promise<PostCategory> {
    try {
      this.logger.log(`Updating post category: ${id}`);

      // Step 1: Check existence
      const category = await this.postCategoryRepository.findById(id);
      if (!category) {
        throw new NotFoundException(`Post category with ID ${id} not found`);
      }

      // Step 2: Validate campus scope
      if (category.campusId !== input.campusId) {
        throw new ForbiddenException(
          "You do not have access to this category in the specified campus",
        );
      }

      // Step 3: Validate uniqueness only if name changed
      if (input.name && input.name !== category.name) {
        const existingByName =
          await this.postCategoryRepository.findByNameInCampus(
            category.campusId,
            input.name,
          );
        if (existingByName) {
          throw new ConflictException(
            `Category "${input.name}" already exists in this campus`,
          );
        }
      }

      // Step 4: Update via domain method
      const updateData: UpdatePostCategoryData = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.order !== undefined) updateData.order = input.order;

      const beforeValue = this.toAuditSnapshot(category);
      category.updateInfo(updateData);

      const updatedCategory = await this.unitOfWork.run(async (tx) => {
        const saved = await tx.updatePostCategory(category);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_POST_CATEGORY",
          targetType: "post_category",
          targetId: saved.id.toString(),
          campusId: input.campusId,
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
      this.logger.error(
        `Failed to update post category: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
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
