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
export class ArchivePostUseCase {
  private readonly logger = new Logger(ArchivePostUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_HISTORY_STATUS_REPOSITORY")
    private readonly postHistoryStatusRepository: PostHistoryStatusRepository,
  ) {}

  async execute(postId: string, currentUser: User): Promise<Post> {
    try {
      this.logger.log(`Archiving post: ${postId}`);
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");
      if (!isAdmin) {
        throw new ForbiddenException("Only administrators can archive posts");
      }

      if (post.status !== PostStatus.PUBLISHED) {
        throw new BadRequestException(
          `Cannot archive a post with status ${post.status}`,
        );
      }

      post.status = PostStatus.ARCHIVED;
      const updatedPost = await this.postRepository.update(postId, post);

      const history = PostHistoryStatus.create({
        postId: new UniqueEntityID(postId),
        userId: new UniqueEntityID(currentUser.id),
        status: PostStatus.ARCHIVED,
        createdAt: new Date(),
      });
      await this.postHistoryStatusRepository.create(history);

      this.logger.log(`Post archived: ${postId}`);
      return updatedPost;
    } catch (error) {
      this.logger.error(
        `Failed to archive post: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
