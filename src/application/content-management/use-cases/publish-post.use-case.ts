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

import { userCanManagePost } from "./authorization/post-permission.helper";

@Injectable()
export class PublishPostUseCase {
  private readonly logger = new Logger(PublishPostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
    comment?: string,
  ): Promise<Post> {
    try {
      this.logger.log(`Publishing post: ${postId}`);

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
            "You are not authorized to publish this post",
          );
        }
        if (post.status !== PostStatus.DRAFT) {
          throw new BadRequestException(
            `Cannot publish a post with status ${post.status}`,
          );
        }

        const latestRequest =
          await tx.findPendingPostApprovalRequestForUpdate(postId);
        if (latestRequest?.isPending()) {
          throw new BadRequestException(
            "This post still has a pending approval request",
          );
        }

        const setting = await tx.findCampusSettingByCampusIdForUpdate(campusId);
        if (setting?.requireTeacherApproval ?? true) {
          throw new BadRequestException(
            "This campus requires posts to be submitted and approved before publishing",
          );
        }

        const beforeValue = this.toAuditSnapshot(post);
        const previousStatus = post.status;
        post.publish(post.publishAt ?? new Date());
        const saved = await tx.updatePost(postId, post);
        await tx.createPostHistoryStatus(
          PostHistoryStatus.create({
            postId,
            changedById: currentUser.id,
            previousStatus,
            newStatus: PostStatus.PUBLISHED,
            reason: comment?.trim() || undefined,
          }),
        );
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "PUBLISH_POST",
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

      this.logger.log(`Post published: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to publish post: ${error.message}`,
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
