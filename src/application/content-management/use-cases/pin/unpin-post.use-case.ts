import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { User } from "@/domain/user-management/user.entity";
import { Post } from "@/domain/content-management";

@Injectable()
export class UnpinPostUseCase {
  private readonly logger = new Logger(UnpinPostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Unpinning post: ${postId}`);

      // Validate admin permission
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");
      if (!isAdmin) {
        throw new ForbiddenException("Only administrators can unpin posts");
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

      // Unpin the post using entity method (idempotent - returns early if not pinned)
      post.unpin();

      // Save
      const updatedPost = await this.postRepository.update(postId, post);

      this.logger.log(`Post unpinned successfully: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to unpin post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
