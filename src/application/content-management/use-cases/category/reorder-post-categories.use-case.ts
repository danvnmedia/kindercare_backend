import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostCategory } from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";

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
  ) {}

  async execute(input: ReorderPostCategoriesInput): Promise<PostCategory[]> {
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
    const reorderedCategories = await this.postCategoryRepository.reorder(
      input.campusId,
      input.ids,
    );

    this.logger.log(
      `Successfully reordered ${reorderedCategories.length} post categories`,
    );

    return reorderedCategories;
  }
}
