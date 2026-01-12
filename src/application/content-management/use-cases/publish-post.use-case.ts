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
export class PublishPostUseCase {
  private readonly logger = new Logger(PublishPostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    currentUser: User,
  ): Promise<Post> {
    try {
      this.logger.log(`Publishing post: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Verify the request campus matches the post's campus
      if (post.campusId !== campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.hasSystemRole();
      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "Only the author or an administrator can publish this post",
        );
      }

      // Note: Post entity publish() method expects DRAFT status
      // This use case expects APPROVED status - need to align business rules
      if (
        post.status !== PostStatus.DRAFT &&
        post.status !== PostStatus.APPROVED
      ) {
        throw new BadRequestException(
          `Cannot publish a post with status ${post.status}`,
        );
      }

      const previousStatus = post.status;
      const publishDate = post.publishAt || new Date();
      if (post.status === PostStatus.DRAFT) {
        post.publish(publishDate);
      } else {
        // For APPROVED posts, manually set status until domain logic is aligned
        post.approve(publishDate);
      }
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: postId,
        changedById: currentUser.id,
        previousStatus,
        newStatus: PostStatus.PUBLISHED,
      });
      await this.postHistoryStatusRepository.create(history);

      this.logger.log(`Post published: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to publish post: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
