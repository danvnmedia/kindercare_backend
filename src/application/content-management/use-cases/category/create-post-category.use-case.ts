import {
  Injectable,
  Inject,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostCategory } from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";

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

  constructor(
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: CreatePostCategoryInput,
    currentUser: User,
  ): Promise<PostCategory> {
    try {
      this.logger.log(`Creating post category: ${input.name}`);

      // Step 1: Check for duplicate name within campus
      const existingByName =
        await this.postCategoryRepository.findByNameInCampus(
          input.campusId,
          input.name,
        );
      if (existingByName) {
        throw new ConflictException(
          `Category "${input.name}" already exists in this campus`,
        );
      }

      // Step 2: Determine order value (auto-calculate if not provided)
      let order: number;
      if (input.order !== undefined) {
        order = input.order;
      } else {
        // Auto-calculate: next order after the current maximum
        const maxOrder = await this.postCategoryRepository.getMaxOrder(
          input.campusId,
        );
        order = maxOrder + 1;
        this.logger.log(`Auto-assigned order: ${order}`);
      }

      // Step 3: Create domain entity (validation happens in factory)
      const category = PostCategory.create({
        campusId: input.campusId,
        name: input.name,
        color: input.color,
        icon: input.icon ?? null,
        order,
      });

      // Step 4: Save to repository
      const savedCategory = await this.unitOfWork.run(async (tx) => {
        const saved = await tx.createPostCategory(category);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "CREATE_POST_CATEGORY",
          targetType: "post_category",
          targetId: saved.id.toString(),
          campusId: input.campusId,
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
      this.logger.error(
        `Failed to create post category: ${error.message}`,
        error.stack,
      );
      if (error instanceof ConflictException) {
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
