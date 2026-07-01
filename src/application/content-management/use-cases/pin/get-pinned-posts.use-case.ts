import { Injectable, Inject, Logger } from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { Post } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class GetPinnedPostsUseCase {
  private readonly logger = new Logger(GetPinnedPostsUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(campusId: string, viewer?: User): Promise<Post[]> {
    try {
      this.logger.log(`Getting pinned posts for campus: ${campusId}`);

      // Repository already filters out expired pins
      const pinnedPosts = await this.postRepository.findPinnedByCampus(
        campusId,
        viewer,
      );

      this.logger.log(
        `Found ${pinnedPosts.length} pinned posts for campus: ${campusId}`,
      );
      return pinnedPosts;
    } catch (error) {
      this.logger.error(
        `Failed to get pinned posts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
