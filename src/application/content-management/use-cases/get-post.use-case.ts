import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { Post } from "@/domain/content-management";
import { PostRepository } from "../ports/post.repository";

@Injectable()
export class GetPostUseCase {
  private readonly logger = new Logger(GetPostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(campusId: string, postId: string): Promise<Post> {
    try {
      this.logger.log(`Getting post: ${postId}`);

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

      return post;
    } catch (error) {
      this.logger.error(`Failed to get post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
