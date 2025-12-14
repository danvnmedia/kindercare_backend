import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../ports/post.repository";
import { PostHistoryStatusRepository } from "../ports/post-history-status.repository";
import { User } from "@/domain/user-management/user.entity";
import {
  PostStatus,
  Post,
  PostHistoryStatus,
} from "@/domain/content-management";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

@Injectable()
export class RevisePostUseCase {
  private readonly logger = new Logger(RevisePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
  ) {}

  async execute(postId: string, currentUser: User): Promise<Post> {
    try {
      this.logger.log(`Revising post: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      if (!isAuthor) {
        throw new ForbiddenException("Only the author can revise this post");
      }

      if (post.status !== PostStatus.REJECTED) {
        throw new BadRequestException(
          `Cannot revise a post with status ${post.status}`,
        );
      }

      post.moveToDraft();
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: postId,
        userId: currentUser.id,
        status: PostStatus.DRAFT,
        comment: "Post revised",
        createdAt: new Date(),
      });
      await this.postHistoryStatusRepository.create(history);

      this.logger.log(`Post revised: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to revise post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
