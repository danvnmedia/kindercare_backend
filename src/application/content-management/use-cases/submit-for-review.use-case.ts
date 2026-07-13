import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";

import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import {
  Post,
  PostApprovalRequest,
  PostHistoryStatus,
  PostStatus,
} from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

import {
  userCanManagePost,
  userHasPostPermission,
} from "./authorization/post-permission.helper";

@Injectable()
export class SubmitForReviewUseCase {
  private readonly logger = new Logger(SubmitForReviewUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
    comment?: string,
  ): Promise<Post> {
    try {
      this.logger.log(`Submitting post for review: ${postId}`);
      if (!userHasPostPermission(currentUser, campusId, "post.update")) {
        throw new ForbiddenException(
          "You do not have permission to submit posts for review",
        );
      }

      const updatedPost = await this.unitOfWork.run(async (tx) => {
        const post = await tx.findPostByIdForUpdate(postId);
        if (!post) {
          throw new NotFoundException(`Post with ID ${postId} not found`);
        }
        if (post.campusId !== campusId) {
          throw new ForbiddenException(
            "You do not have access to this post in the specified campus",
          );
        }
        if (!userCanManagePost(currentUser, campusId, post.authorId)) {
          throw new ForbiddenException(
            "You are not authorized to submit this post for review",
          );
        }
        if (post.status !== PostStatus.DRAFT) {
          throw new BadRequestException(
            `Cannot submit a post with status ${post.status}`,
          );
        }

        const latestRequest =
          await tx.findPendingPostApprovalRequestForUpdate(postId);
        if (latestRequest?.isPending()) {
          throw new BadRequestException(
            "This post already has a pending approval request",
          );
        }

        const setting = await tx.findCampusSettingByCampusIdForUpdate(campusId);
        const requiresApproval = setting?.requireTeacherApproval ?? true;
        const beforeValue = this.toAuditSnapshot(post);

        if (requiresApproval) {
          post.submitForReview();
        } else {
          post.publish(post.publishAt ?? new Date());
        }

        const saved = await tx.updatePost(postId, post);
        const history = PostHistoryStatus.create({
          postId,
          changedById: currentUser.id,
          previousStatus: PostStatus.DRAFT,
          newStatus: saved.status,
          reason: comment?.trim() || undefined,
        });
        await tx.createPostHistoryStatus(history);

        if (requiresApproval) {
          const approvalRequest = PostApprovalRequest.create({
            postId,
            submittedById: currentUser.id,
            titleSnapshot: saved.title,
            contentSnapshot: saved.content,
          });
          await tx.createPostApprovalRequest(approvalRequest);
        }

        await tx.recordAudit({
          actorId: currentUser.id,
          action: "SUBMIT_POST_FOR_REVIEW",
          targetType: "post",
          targetId: postId,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.title,
            requiresApproval,
          },
          beforeValue,
          afterValue: this.toAuditSnapshot(saved),
        });

        return saved;
      });

      this.logger.log(`Post submission completed: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to submit post for review: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private toAuditSnapshot(post: Post): Record<string, unknown> {
    return {
      title: post.title,
      status: post.status,
      publishAt: post.publishAt?.toISOString() ?? null,
      contentVersion: post.contentVersion,
    };
  }
}
