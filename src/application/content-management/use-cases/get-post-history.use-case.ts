import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
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

  async execute(
    campusId: string,
    postId: string,
  ): Promise<PostHistoryStatus[]> {
    try {
      this.logger.log(`Getting post history for post: ${postId}`);

      const post = await this.postRepository.findById(postId);
      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Verify the post belongs to the specified campus
      if (post.campusId !== campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
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
