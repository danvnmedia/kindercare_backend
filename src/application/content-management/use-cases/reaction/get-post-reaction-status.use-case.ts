import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostReactionRepository } from "../../ports/post-reaction.repository";
import { User } from "@/domain/user-management/user.entity";

export interface PostReactionStatusResult {
  hearted: boolean;
  count: number;
}

@Injectable()
export class GetPostReactionStatusUseCase {
  private readonly logger = new Logger(GetPostReactionStatusUseCase.name);

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
  ): Promise<PostReactionStatusResult> {
    try {
      this.logger.log(
        `Getting reaction status for post: ${postId}, user: ${currentUser.id}`,
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

      const [hearted, count] = await Promise.all([
        this.postReactionRepository.existsByPostAndUser(postId, currentUser.id),
        this.postReactionRepository.countByPost(postId),
      ]);

      this.logger.log(
        `Reaction status for post ${postId}: hearted=${hearted}, count=${count}`,
      );

      return { hearted, count };
    } catch (error) {
      this.logger.error(
        `Failed to get reaction status: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
