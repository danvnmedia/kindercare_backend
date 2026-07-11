import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostReactionRepository } from "../../ports/post-reaction.repository";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { User } from "@/domain/user-management/user.entity";

export interface PostReactionStatusResult {
  hasReacted: boolean;
  reactionCount: number;
}

@Injectable()
export class GetPostReactionStatusUseCase {
  private readonly logger = new Logger(GetPostReactionStatusUseCase.name);

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
  ): Promise<PostReactionStatusResult> {
    try {
      this.logger.log(
        `Getting reaction status for post: ${postId}, user: ${currentUser.id}`,
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
          "Cannot view reactions for this post. Post must be published and not deleted.",
        );
      }

      const setting =
        await this.campusSettingRepository.findByCampusId(campusId);
      if (setting && !setting.allowReactions) {
        return { hasReacted: false, reactionCount: 0 };
      }

      const [hasReacted, reactionCount] = await Promise.all([
        this.postReactionRepository.existsByPostAndUser(postId, currentUser.id),
        this.postReactionRepository.countByPost(postId),
      ]);

      this.logger.log(
        `Reaction status for post ${postId}: hasReacted=${hasReacted}, reactionCount=${reactionCount}`,
      );

      return { hasReacted, reactionCount };
    } catch (error) {
      this.logger.error(
        `Failed to get reaction status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
