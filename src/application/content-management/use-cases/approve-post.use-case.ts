import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../ports/post.repository";
import { PostHistoryStatusRepository } from "../ports/post-history-status.repository";
import { PostApprovalRequestRepository } from "../ports/post-approval-request.repository";
import { User } from "@/domain/user-management/user.entity";
import {
  PostStatus,
  Post,
  PostHistoryStatus,
} from "@/domain/content-management";

@Injectable()
export class ApprovePostUseCase {
  private readonly logger = new Logger(ApprovePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
    @Inject("POST_APPROVAL_REQUEST_REPOSITORY")
    private readonly postApprovalRequestRepository: PostApprovalRequestRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Approving post: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Verify the request campus matches the post's campus
      if (post.campusId !== campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      const isAdmin = currentUser.hasSystemRole();
      if (!isAdmin) {
        throw new ForbiddenException("Only administrators can approve posts");
      }

      if (post.status !== PostStatus.PENDING_REVIEW) {
        throw new BadRequestException(
          `Cannot approve a post with status ${post.status}`,
        );
      }

      // Find and update the approval request if exists
      const approvalRequest =
        await this.postApprovalRequestRepository.findLatestByPostId(postId);
      if (approvalRequest && approvalRequest.isPending()) {
        approvalRequest.approve(currentUser.id);
        await this.postApprovalRequestRepository.update(approvalRequest);
      }

      const previousStatus = post.status;
      post.approve();
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: postId,
        changedById: currentUser.id,
        previousStatus,
        newStatus: PostStatus.PUBLISHED,
      });
      await this.postHistoryStatusRepository.create(history);

      this.logger.log(`Post approved: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to approve post: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
