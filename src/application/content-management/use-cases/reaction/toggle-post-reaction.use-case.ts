import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostReactionRepository } from "../../ports/post-reaction.repository";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { PostReaction } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

export interface TogglePostReactionResult {
  hasReacted: boolean;
  reactionCount: number;
}

@Injectable()
export class TogglePostReactionUseCase {
  private readonly logger = new Logger(TogglePostReactionUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_REACTION_REPOSITORY")
    private readonly postReactionRepository: PostReactionRepository,
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<TogglePostReactionResult> {
    try {
      this.logger.log(
        `Toggling reaction for post: ${postId}, user: ${currentUser.id}`,
      );

      const post = await this.postRepository.findVisibleById(
        postId,
        campusId,
        currentUser,
      );
      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      if (!post.canReceiveEngagement()) {
        throw new BadRequestException(
          "Cannot react to this post. Post must be published and not deleted.",
        );
      }

      const setting =
        await this.campusSettingRepository.findByCampusId(campusId);
      if (setting && !setting.allowReactions) {
        throw new ForbiddenException("Reactions are disabled for this campus");
      }

      const existingReaction =
        await this.postReactionRepository.findByPostAndUser(
          postId,
          currentUser.id,
        );

      let hasReacted: boolean;
      if (existingReaction) {
        await this.postReactionRepository.delete(postId, currentUser.id);
        hasReacted = false;
        this.logger.log(`Reaction removed for post: ${postId}`);
      } else {
        const reaction = PostReaction.create({
          postId,
          userId: currentUser.id,
        });
        try {
          await this.postReactionRepository.save(reaction);
        } catch (error) {
          if (
            !this.isUniqueConstraintError(error) ||
            !(await this.postReactionRepository.existsByPostAndUser(
              postId,
              currentUser.id,
            ))
          ) {
            throw error;
          }
          this.logger.warn(
            `Concurrent reaction add reconciled for post: ${postId}, user: ${currentUser.id}`,
          );
        }
        hasReacted = true;
        this.logger.log(`Reaction added for post: ${postId}`);
      }

      const reactionCount =
        await this.postReactionRepository.countByPost(postId);
      return { hasReacted, reactionCount };
    } catch (error) {
      this.logger.error(
        `Failed to toggle reaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    );
  }
}
