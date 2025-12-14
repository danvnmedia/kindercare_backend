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
export class RejectPostUseCase {
  private readonly logger = new Logger(RejectPostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
  ) {}

  async execute(
    postId: string,
    currentUser: User,
    comment: string,
  ): Promise<Post> {
    try {
      this.logger.log(`Rejecting post: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");
      if (!isAdmin) {
        throw new ForbiddenException("Only administrators can reject posts");
      }

      if (!comment || comment.trim().length === 0) {
        throw new BadRequestException(
          "A comment is required when rejecting a post",
        );
      }

      if (post.status !== PostStatus.PENDING_REVIEW) {
        throw new BadRequestException(
          `Cannot reject a post with status ${post.status}`,
        );
      }

      post.reject();
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: postId,
        userId: currentUser.id,
        status: PostStatus.REJECTED,
        comment,
        createdAt: new Date(),
      });
      await this.postHistoryStatusRepository.create(history);

      this.logger.log(`Post rejected: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(`Failed to reject post: ${error.message}`, error.stack);
      throw error;
    }
  }
}
