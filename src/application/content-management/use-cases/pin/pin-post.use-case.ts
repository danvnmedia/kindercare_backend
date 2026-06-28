import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { User } from "@/domain/user-management/user.entity";
import { Post, PostStatus, CampusSetting } from "@/domain/content-management";

export interface PinPostInput {
  pinnedUntil?: Date | null;
}

@Injectable()
export class PinPostUseCase {
  private readonly logger = new Logger(PinPostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    input: PinPostInput,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Pinning post: ${postId}`);

      // Validate admin permission
      const isAdmin = currentUser.hasSystemRole();
      if (!isAdmin) {
        throw new ForbiddenException("Only administrators can pin posts");
      }

      // Find the post
      const post = await this.postRepository.findById(postId);
      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Verify the post belongs to the specified campus
      if (post.campusId !== campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      // Validate post is published
      if (post.status !== PostStatus.PUBLISHED) {
        throw new BadRequestException(
          `Cannot pin a post with status ${post.status}. Only published posts can be pinned.`,
        );
      }

      // Check if already pinned
      if (post.isPinned && !post.isPinExpired()) {
        throw new BadRequestException("Post is already pinned");
      }

      // Get campus settings for max pinned posts limit
      let campusSettings = await this.campusSettingRepository.findByCampusId(
        post.campusId,
      );
      if (!campusSettings) {
        // Create default settings if none exist
        campusSettings = CampusSetting.create({ campusId: post.campusId });
      }

      // Count current pinned posts
      const currentPinnedCount = await this.postRepository.countPinnedByCampus(
        post.campusId,
      );

      // Check limit
      if (currentPinnedCount >= campusSettings.maxPinnedPosts) {
        throw new BadRequestException(
          `Cannot pin more posts. Maximum ${campusSettings.maxPinnedPosts} pinned posts allowed. Unpin another post first.`,
        );
      }

      // Pin the post using entity method
      post.pin(currentUser.id, input.pinnedUntil);

      // Save
      const updatedPost = await this.postRepository.update(postId, post);

      this.logger.log(`Post pinned successfully: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to pin post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
