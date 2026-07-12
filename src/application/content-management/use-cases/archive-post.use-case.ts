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
  PostHistoryStatus,
  PostStatus,
} from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

import {
  userCanManagePost,
  userHasPostPermission,
} from "./authorization/post-permission.helper";

@Injectable()
export class ArchivePostUseCase {
  private readonly logger = new Logger(ArchivePostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
    comment?: string,
  ): Promise<Post> {
    try {
      this.logger.log(`Archiving post: ${postId}`);
      if (!userHasPostPermission(currentUser, campusId, "post.update")) {
        throw new ForbiddenException(
          "You do not have permission to archive posts",
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
            "You are not authorized to archive this post",
          );
        }
        if (
          post.status !== PostStatus.DRAFT &&
          post.status !== PostStatus.PUBLISHED
        ) {
          throw new BadRequestException(
            `Cannot archive a post with status ${post.status}`,
          );
        }
        const pendingRequest =
          await tx.findPendingPostApprovalRequestForUpdate(postId);
        if (pendingRequest) {
          throw new BadRequestException(
            "Posts with a pending approval request cannot be archived",
          );
        }

        const beforeValue = this.toAuditSnapshot(post);
        const previousStatus = post.status;
        post.archive();
        post.unpin();
        const saved = await tx.updatePost(postId, post);
        await tx.createPostHistoryStatus(
          PostHistoryStatus.create({
            postId,
            changedById: currentUser.id,
            previousStatus,
            newStatus: PostStatus.ARCHIVED,
            reason: comment?.trim() || undefined,
          }),
        );
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "ARCHIVE_POST",
          targetType: "post",
          targetId: postId,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: saved.title,
          },
          beforeValue,
          afterValue: this.toAuditSnapshot(saved),
        });
        return saved;
      });

      this.logger.log(`Post archived: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to archive post: ${error.message}`,
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
      isPinned: post.isPinned,
    };
  }
}
