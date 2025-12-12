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

  async execute(postId: string, currentUser: User): Promise<Post> {
    try {
      this.logger.log(`Publishing post: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");
      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "Only the author or an administrator can publish this post",
        );
      }

      if (post.status !== PostStatus.APPROVED) {
        throw new BadRequestException(
          `Cannot publish a post with status ${post.status}`,
        );
      }

      post.status = PostStatus.PUBLISHED;
      if (!post.publishAt) {
        post.publishAt = new Date();
      }
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: new UniqueEntityID(postId),
        userId: new UniqueEntityID(currentUser.id),
        status: PostStatus.PUBLISHED,
        createdAt: new Date(),
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
