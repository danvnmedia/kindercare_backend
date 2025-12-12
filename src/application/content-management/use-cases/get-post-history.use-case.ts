import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { PostHistoryStatusRepository } from "../ports/post-history-status.repository";
import { PostHistoryStatus } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";

@Injectable()
export class GetPostHistoryUseCase {
  private readonly logger = new Logger(GetPostHistoryUseCase.name);

  constructor(
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(postId: string): Promise<PostHistoryStatus[]> {
    try {
      this.logger.log(`Getting post history for post: ${postId}`);

      const post = await this.postRepository.findById(postId);
      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      const history =
        await this.postHistoryStatusRepository.findByPostId(postId);
      this.logger.log(
        `Retrieved ${history.length} history records for post ${postId}`,
      );
      return history;
    } catch (error) {
      this.logger.error(
        `Failed to get post history: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
