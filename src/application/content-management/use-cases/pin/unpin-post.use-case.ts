import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { Post } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { userHasPostPermission } from "../authorization/post-permission.helper";

@Injectable()
export class UnpinPostUseCase {
  private readonly logger = new Logger(UnpinPostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<Post> {
    this.logger.log(`Unpinning post: ${postId}`);

    if (!userHasPostPermission(currentUser, campusId, "post.manage")) {
      throw new ForbiddenException("You do not have permission to unpin posts");
    }

    const updatedPost = await this.unitOfWork.run(async (tx) => {
      await tx.lockPostPinCapacity(campusId);
      const post = await tx.findPostByIdForUpdate(postId);
      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }
      if (post.campusId !== campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }
      if (!post.isPinned) {
        return post;
      }

      return tx.updatePostPin(postId, {
        isPinned: false,
        pinnedById: null,
        pinnedUntil: null,
      });
    });

    this.logger.log(`Post unpinned successfully: ${postId}`);
    return updatedPost;
  }
}
