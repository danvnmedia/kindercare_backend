import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { User } from "@/domain/user-management/user.entity";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { PostStatus } from "@/domain/content-management";
import { userCanManagePost } from "./authorization/post-permission.helper";

@Injectable()
export class DeletePostUseCase {
  private readonly logger = new Logger(DeletePostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<void> {
    try {
      this.logger.log(`Deleting post: ${postId}`);

      await this.unitOfWork.run(async (tx) => {
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
            "You are not authorized to delete this post",
          );
        }
        if (post.status === PostStatus.PENDING_REVIEW) {
          throw new ConflictException(
            "Pending-review posts cannot be deleted. Revise or resolve the approval request first.",
          );
        }

        await tx.deletePost(postId);
        await tx.recordAudit({
          actorId: currentUser.id,
          action: "DELETE_POST",
          targetType: "post",
          targetId: postId,
          campusId,
          context: {
            actorName: currentUser.profile?.fullName ?? null,
            targetName: post.title,
          },
          beforeValue: {
            title: post.title,
            status: post.status,
            contentVersion: post.contentVersion,
          },
        });
      });
      this.logger.log(`Post deleted: ${postId}`);
    } catch (error) {
      this.logger.error(`Failed to delete post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
