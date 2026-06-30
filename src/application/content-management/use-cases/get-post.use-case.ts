import { Injectable, Inject, NotFoundException, Logger } from "@nestjs/common";
import { Post } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { PostRepository } from "../ports/post.repository";

@Injectable()
export class GetPostUseCase {
  private readonly logger = new Logger(GetPostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(campusId: string, postId: string, viewer: User): Promise<Post> {
    try {
      this.logger.log(`Getting post: ${postId}`);

      const post = await this.postRepository.findVisibleById(
        postId,
        campusId,
        viewer,
      );

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      return post;
    } catch (error) {
      this.logger.error(`Failed to get post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
