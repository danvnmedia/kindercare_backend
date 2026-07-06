import { Injectable, Inject, Logger } from "@nestjs/common";
import { Post } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { PostRepository, PostAudienceFacets } from "../ports/post.repository";
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
    viewer: User,
  ): Promise<PaginatedResult<Post>> {
    try {
      this.logger.log(`Listing posts for campus: ${campusId}`);

      // Default sort: pinned posts first, then by most recent
      if (!query.sort) {
        query.sort = "-isPinned,-createdAt";
      }

      return this.postRepository.findMany(query, { campusId }, viewer);
    } catch (error) {
      this.logger.error(`Failed to list posts: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getAudienceFacets(
    campusId: string,
    query: StandardRequestDto,
    viewer: User,
  ): Promise<PostAudienceFacets> {
    try {
      this.logger.log(
        `Listing CMS post audience facets for campus: ${campusId}`,
      );
      return this.postRepository.findAudienceFacets(campusId, query, viewer);
    } catch (error) {
      this.logger.error(
        `Failed to list CMS post audience facets: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
