import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostReactionRepository } from "../../ports/post-reaction.repository";
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

      const existingReaction =
        await this.postReactionRepository.findByPostAndUser(
          postId,
          currentUser.id,
        );

      let hasReacted: boolean;
      let reactionCount: number;

      if (existingReaction) {
        await this.postReactionRepository.delete(postId, currentUser.id);
        reactionCount = await this.postReactionRepository.countByPost(postId);
        hasReacted = false;
        this.logger.log(`Reaction removed for post: ${postId}`);
      } else {
        const reaction = PostReaction.create({
          postId,
          userId: currentUser.id,
        });
        await this.postReactionRepository.save(reaction);
        reactionCount = await this.postReactionRepository.countByPost(postId);
        hasReacted = true;
        this.logger.log(`Reaction added for post: ${postId}`);
      }

      return { hasReacted, reactionCount };
    } catch (error) {
      this.logger.error(
        `Failed to toggle reaction: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
