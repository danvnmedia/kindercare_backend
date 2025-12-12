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
export class SubmitForReviewUseCase {
  private readonly logger = new Logger(SubmitForReviewUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
  ) {}

  async execute(postId: string, currentUser: User): Promise<Post> {
    try {
      this.logger.log(`Submitting post for review: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      if (!isAuthor) {
        throw new ForbiddenException(
          "Only the author can submit this post for review",
        );
      }

      if (post.status !== PostStatus.DRAFT) {
        throw new BadRequestException(
          `Cannot submit a post with status ${post.status}`,
        );
      }

      post.status = PostStatus.PENDING_REVIEW;
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: new UniqueEntityID(postId),
        userId: new UniqueEntityID(currentUser.id),
        status: PostStatus.PENDING_REVIEW,
        createdAt: new Date(),
      });
      await this.postHistoryStatusRepository.create(history);

      this.logger.log(`Post submitted for review: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to submit post for review: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
