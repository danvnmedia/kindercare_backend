import { Injectable, Inject, Logger } from "@nestjs/common";
import { Post } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class ListPostsUseCase {
  private readonly logger = new Logger(ListPostsUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    campusId: string,
    query: StandardRequestDto,
  ): Promise<PaginatedResult<Post>> {
    try {
      this.logger.log(`Listing posts for campus: ${campusId}`);

      // Force campus filter - parse existing filter or create new one
      const existingFilter = query.filter ? JSON.parse(query.filter) : {};
      existingFilter.campusId = campusId;
      query.filter = JSON.stringify(existingFilter);

      // Default sort: pinned posts first, then by most recent
      if (!query.sort) {
        query.sort = "-isPinned,-createdAt";
      }

      return this.postRepository.findMany(query);
    } catch (error) {
      this.logger.error(`Failed to list posts: ${error.message}`, error.stack);
      throw error;
    }
  }
}
