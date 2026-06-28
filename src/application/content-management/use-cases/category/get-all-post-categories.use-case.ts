import { Injectable, Inject, Logger } from "@nestjs/common";
import { PostCategory } from "@/domain/content-management";
import { PostCategoryRepository } from "../../ports/post-category.repository";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class GetAllPostCategoriesUseCase {
  private readonly logger = new Logger(GetAllPostCategoriesUseCase.name);

  constructor(
    @Inject("POST_CATEGORY_REPOSITORY")
    private readonly postCategoryRepository: PostCategoryRepository,
  ) {}

  async execute(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostCategory>> {
    this.logger.log(
      `Fetching post categories: offset=${params.offset ?? 0}, limit=${params.limit ?? 10}`,
    );

    const result = await this.postCategoryRepository.findByCampusId(
      campusId,
      params,
    );

    this.logger.log(`Found ${result.data.length} post categories`);

    return result;
  }
}
