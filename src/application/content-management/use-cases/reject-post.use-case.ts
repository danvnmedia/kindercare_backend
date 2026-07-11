import { isDeepStrictEqual } from "node:util";

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

import { userHasPostPermission } from "./authorization/post-permission.helper";

@Injectable()
export class RejectPostUseCase {
  private readonly logger = new Logger(RejectPostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
    comment: string,
  ): Promise<Post> {
    try {
      this.logger.log(`Rejecting post: ${postId}`);
      if (!userHasPostPermission(currentUser, campusId, "post.review")) {
        throw new ForbiddenException(
          "You do not have permission to reject posts",
        );
      }
      const reason = comment?.trim();
      if (!reason) {
        throw new BadRequestException(
          "A comment is required when rejecting a post",
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
        if (post.status !== PostStatus.PENDING_REVIEW) {
          throw new BadRequestException(
            `Cannot reject a post with status ${post.status}`,
          );
        }

        const approvalRequest =
          await tx.findLatestPostApprovalRequestForUpdate(postId);
        this.assertCurrentPendingSnapshot(post, approvalRequest);
        const beforeValue = this.toAuditSnapshot(post);
        const previousStatus = post.status;

        approvalRequest.reject(currentUser.id, reason);
        post.reject();

        await tx.updatePostApprovalRequestIfPending(approvalRequest);
        const saved = await tx.updatePost(postId, post);
        await tx.createPostHistoryStatus(
          PostHistoryStatus.create({
            postId,
            changedById: currentUser.id,
            previousStatus,
            newStatus: PostStatus.DRAFT,
            reason,
          }),
        );
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "REJECT_POST",
          targetType: "post",
          targetId: postId,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.title,
            approvalRequestId: approvalRequest.id.toString(),
            reason,
          },
          beforeValue,
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });

      this.logger.log(`Post rejected: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to reject post: ${error.message}`, error.stack);
      throw error;
    }
  }

  private assertCurrentPendingSnapshot(
    post: Post,
    request: PostApprovalRequest | null,
  ): asserts request is PostApprovalRequest {
    if (!request || !request.isPending()) {
      throw new BadRequestException(
        "The latest approval request is missing or no longer pending",
      );
    }
    if (
      request.titleSnapshot !== post.title ||
      !isDeepStrictEqual(request.contentSnapshot, post.content)
    ) {
      throw new BadRequestException(
        "Post content no longer matches the submitted approval snapshot",
      );
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
