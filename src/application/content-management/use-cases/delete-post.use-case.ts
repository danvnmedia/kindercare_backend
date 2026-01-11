import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../ports/post.repository";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class DeletePostUseCase {
  private readonly logger = new Logger(DeletePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<void> {
    try {
      this.logger.log(`Deleting post: ${postId}`);

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

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "You are not authorized to delete this post",
        );
      }

      await this.postRepository.delete(postId);
      this.logger.log(`Post deleted: ${postId}`);
    } catch (error) {
      this.logger.error(`Failed to delete post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
