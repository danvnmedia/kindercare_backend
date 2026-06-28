import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostApprovalRequestRepository } from "../../ports/post-approval-request.repository";
import { PostRepository } from "../../ports/post.repository";
import { PostApprovalRequest } from "@/domain/content-management";

@Injectable()
export class GetPostApprovalHistoryUseCase {
  private readonly logger = new Logger(GetPostApprovalHistoryUseCase.name);

  constructor(
    @Inject("POST_APPROVAL_REQUEST_REPOSITORY")
    private readonly postApprovalRequestRepository: PostApprovalRequestRepository,
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
  ): Promise<PostApprovalRequest[]> {
    try {
      this.logger.log(`Getting approval history for post: ${postId}`);

      // Verify post exists
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
        await this.postApprovalRequestRepository.findByPostId(postId);

      this.logger.log(`Found ${history.length} approval requests for post`);
      return history;
    } catch (error) {
      this.logger.error(
        `Failed to get approval history: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
