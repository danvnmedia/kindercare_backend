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

import { userCanManagePost } from "./authorization/post-permission.helper";

const REVISION_REASON = "Post revised before approval";

@Injectable()
export class RevisePostUseCase {
  private readonly logger = new Logger(RevisePostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
    comment?: string,
  ): Promise<Post> {
    try {
      this.logger.log(`Revising post: ${postId}`);

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
            "You are not authorized to revise this post",
          );
        }
        if (
          post.status !== PostStatus.PENDING_REVIEW &&
          post.status !== PostStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            `Cannot revise a post with status ${post.status}`,
          );
        }

        const beforeValue = this.toAuditSnapshot(post);
        const previousStatus = post.status;
        let approvalRequest: PostApprovalRequest | null = null;

        if (post.status === PostStatus.PENDING_REVIEW) {
          approvalRequest =
            await tx.findLatestPostApprovalRequestForUpdate(postId);
          this.assertCurrentPendingSnapshot(post, approvalRequest);
          approvalRequest.reject(currentUser.id, REVISION_REASON);
          await tx.updatePostApprovalRequestIfPending(approvalRequest);
        }

        post.moveToDraft();
        post.unpin();
        const saved = await tx.updatePost(postId, post);
        await tx.createPostHistoryStatus(
          PostHistoryStatus.create({
            postId,
            changedById: currentUser.id,
            previousStatus,
            newStatus: PostStatus.DRAFT,
            reason: comment?.trim() || REVISION_REASON,
          }),
        );
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "UPDATE_POST",
          targetType: "post",
          targetId: postId,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.title,
            workflowAction: "REVISE",
            approvalRequestId: approvalRequest?.id.toString() ?? null,
          },
          beforeValue,
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });

      this.logger.log(`Post revised: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to revise post: ${error.message}`, error.stack);
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
      isPinned: post.isPinned,
    };
  }
}
