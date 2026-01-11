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
import { CampusSettingRepository } from "../ports/campus-setting.repository";
import { User } from "@/domain/user-management/user.entity";
import {
  PostStatus,
  Post,
  PostHistoryStatus,
  PostApprovalRequest,
} from "@/domain/content-management";

@Injectable()
export class SubmitForReviewUseCase {
  private readonly logger = new Logger(SubmitForReviewUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
    @Inject("POST_APPROVAL_REQUEST_REPOSITORY")
    private readonly postApprovalRequestRepository: PostApprovalRequestRepository,
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Submitting post for review: ${postId}`);
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

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      if (!isAuthor) {
        throw new ForbiddenException(
          "Only the author can submit this post for review",
        );
      }

      if (post.status !== PostStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot submit a post with status ${post.status}`,
        );
      }

      // Check campus setting for approval requirement
      const campusSetting = await this.campusSettingRepository.findByCampusId(
        post.campusId,
      );
      const requiresApproval = campusSetting?.requireTeacherApproval ?? true; // Default to true

      // If approval is not required, auto-publish the post
      if (!requiresApproval) {
        const previousStatus = post.status;
        post.publish();
        const updatedPost = await this.postRepository.update(postId, post);

        // Create history record for PUBLISHED status
        const history = PostHistoryStatus.create({
          postId: postId,
          changedById: currentUser.id,
          previousStatus,
          newStatus: PostStatus.PUBLISHED,
        });
        await this.postHistoryStatusRepository.create(history);

        this.logger.log(
          `Post auto-published (approval not required): ${postId}`,
        );
        return updatedPost;
      }

      // Approval is required - submit for review
      const previousStatus = post.status;
      post.submitForReview();
      const updatedPost = await this.postRepository.update(postId, post);

      // Create history record for PENDING_REVIEW status
      const history = PostHistoryStatus.create({
        postId: postId,
        changedById: currentUser.id,
        previousStatus,
        newStatus: PostStatus.PENDING_REVIEW,
      });
      await this.postHistoryStatusRepository.create(history);

      // Create PostApprovalRequest with snapshot
      const approvalRequest = PostApprovalRequest.create({
        postId: postId,
        submittedById: currentUser.id,
        titleSnapshot: post.title,
        contentSnapshot: post.content as Record<string, unknown>,
      });
      await this.postApprovalRequestRepository.save(approvalRequest);

      this.logger.log(`Post submitted for review: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to submit post for review: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
