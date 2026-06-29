import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostCategory } from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { User } from "@/domain/user-management/user.entity";

export interface ReorderPostCategoriesInput {
  campusId: string;
  ids: string[];
}

@Injectable()
export class ReorderPostCategoriesUseCase {
  private readonly logger = new Logger(ReorderPostCategoriesUseCase.name);

  constructor(
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}

  async execute(
    input: ReorderPostCategoriesInput,
    currentUser: User,
  ): Promise<PostCategory[]> {
    this.logger.log(`Reordering ${input.ids.length} post categories`);

    // Step 1: Validate all IDs exist
    const missingIds: string[] = [];
    for (const id of input.ids) {
      const category = await this.postCategoryRepository.findById(id);
      if (!category) {
        missingIds.push(id);
      }
    }

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `Post category(ies) not found: ${missingIds.join(", ")}`,
      );
    }

    // Step 2: Reorder categories within the campus
    const beforeValue = { ids: [...input.ids] };
    const reorderedCategories = await this.unitOfWork.run(async (tx) => {
      const saved = await tx.reorderPostCategories(input.campusId, input.ids);
      await tx.recordAudit({
        actorId: currentUser.id,
        action: "REORDER_POST_CATEGORIES",
        targetType: "post_category",
        targetId: saved[0]?.id.toString() ?? input.ids[0],
        campusId: input.campusId,
        context: {
          actorName: currentUser.profile?.fullName ?? null,
          orderedIds: input.ids,
        },
        beforeValue,
        afterValue: { ids: saved.map((category) => category.id.toString()) },
      });
      return saved;
    });

    this.logger.log(
      `Successfully reordered ${reorderedCategories.length} post categories`,
    );

    return reorderedCategories;
  }
}
