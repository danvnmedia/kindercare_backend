import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  PostCategory,
  UpdatePostCategoryData,
} from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";

export interface UpdatePostCategoryInput {
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
  ) {}

  async execute(
    id: string,
    input: UpdatePostCategoryInput,
  ): Promise<PostCategory> {
    try {
      this.logger.log(`Updating post category: ${id}`);

      // Step 1: Check existence
      const category = await this.postCategoryRepository.findById(id);
      if (!category) {
        throw new NotFoundException(`Post category with ID ${id} not found`);
      }

      // Step 2: Validate uniqueness only if name changed
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

      // Step 3: Update via domain method
      const updateData: UpdatePostCategoryData = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.color !== undefined) updateData.color = input.color;
      if (input.icon !== undefined) updateData.icon = input.icon;
      if (input.order !== undefined) updateData.order = input.order;

      category.updateInfo(updateData);

      // Step 4: Save to repository
      const updatedCategory =
        await this.postCategoryRepository.update(category);
      this.logger.log(`Post category updated successfully: ${id}`);

      return updatedCategory;
    } catch (error) {
      this.logger.error(
        `Failed to update post category: ${error.message}`,
        error.stack,
      );
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }
}
