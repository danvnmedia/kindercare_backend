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

    const normalizedParams = this.mapIsActiveFilter(params);

    const result = await this.postCategoryRepository.findByCampusId(
      campusId,
      normalizedParams,
    );

    this.logger.log(`Found ${result.data.length} post categories`);

    return result;
  }

  private mapIsActiveFilter(params: StandardRequest): StandardRequest {
    const filters = params.filterInfo?.filters;
    if (!filters || !("isActive" in filters)) {
      return params;
    }

    const { isActive, ...rest } = filters;
    const rawValue =
      typeof isActive === "object" && isActive !== null && "eq" in isActive
        ? (isActive as { eq?: unknown }).eq
        : isActive;
    const activeValue = this.toBoolean(rawValue);

    return {
      ...params,
      filterInfo: {
        ...params.filterInfo,
        filters: {
          ...rest,
          isArchived: !activeValue,
        },
      },
    };
  }

  private toBoolean(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return Boolean(value);
  }
}
