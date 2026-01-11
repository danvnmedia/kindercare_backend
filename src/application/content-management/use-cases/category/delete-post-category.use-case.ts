import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { PostCategory } from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";

@Injectable()
export class DeletePostCategoryUseCase {
  private readonly logger = new Logger(DeletePostCategoryUseCase.name);

  constructor(
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
  ) {}

  async execute(id: string): Promise<PostCategory> {
    this.logger.log(`Deactivating post category: ${id}`);

    // Step 1: Check existence
    const category = await this.postCategoryRepository.findById(id);
    if (!category) {
      throw new NotFoundException(`Post category with ID ${id} not found`);
    }

    // Step 2: Deactivate (soft delete) via domain method
    category.deactivate();

    // Step 3: Save to repository
    const deactivatedCategory =
      await this.postCategoryRepository.update(category);
    this.logger.log(`Post category deactivated successfully: ${id}`);

    return deactivatedCategory;
  }
}
