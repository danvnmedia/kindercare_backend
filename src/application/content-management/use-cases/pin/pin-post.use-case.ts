import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { UnitOfWorkPort } from "@/application/ports/unit-of-work.port";
import { CampusSetting, Post, PostStatus } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { userHasPostPermission } from "../authorization/post-permission.helper";

export interface PinPostInput {
  pinnedUntil?: Date | null;
}

@Injectable()
export class PinPostUseCase {
  private readonly logger = new Logger(PinPostUseCase.name);

  constructor(private readonly unitOfWork: UnitOfWorkPort) {}

  async execute(
    campusId: string,
    postId: string,
    input: PinPostInput,
    currentUser: User,
  ): Promise<Post> {
    this.logger.log(`Pinning post: ${postId}`);

    if (!userHasPostPermission(currentUser, campusId, "post.manage")) {
      throw new ForbiddenException("You do not have permission to pin posts");
    }

    const now = new Date();
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
      if (post.status !== PostStatus.PUBLISHED) {
        throw new BadRequestException(
          `Cannot pin a post with status ${post.status}. Only published posts can be pinned.`,
        );
      }
      if (post.isPinned && !post.isPinExpired()) {
        throw new BadRequestException("Post is already pinned");
      }
      if (input.pinnedUntil && input.pinnedUntil <= now) {
        throw new BadRequestException("Pin expiration must be in the future");
      }

      const campusSettings =
        (await tx.findCampusSettingByCampusIdForUpdate(campusId)) ??
        CampusSetting.create({ campusId });
      const currentPinnedCount = await tx.countEffectivePinnedPosts(
        campusId,
        now,
      );
      if (currentPinnedCount >= campusSettings.maxPinnedPosts) {
        throw new BadRequestException(
          `Cannot pin more posts. Maximum ${campusSettings.maxPinnedPosts} pinned posts allowed. Unpin another post first.`,
        );
      }

      return tx.updatePostPin(postId, {
        isPinned: true,
        pinnedById: currentUser.id,
        pinnedUntil: input.pinnedUntil ?? null,
      });
    });

    this.logger.log(`Post pinned successfully: ${postId}`);
    return updatedPost;
  }
}
