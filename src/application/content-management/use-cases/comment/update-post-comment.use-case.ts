import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { PostComment } from "@/domain/content-management";
import { PostCommentType } from "@/domain/content-management/entities/post-comment.entity";
import { User } from "@/domain/user-management/user.entity";

export interface UpdatePostCommentInput {
  content: string;
}

@Injectable()
export class UpdatePostCommentUseCase {
  private readonly logger = new Logger(UpdatePostCommentUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async execute(
    commentId: string,
    campusId: string,
    input: UpdatePostCommentInput,
    currentUser: User,
  ): Promise<PostComment> {
    try {
      this.logger.log(
        `Updating comment: ${commentId} by user: ${currentUser.id}`,
      );

      const comment = await this.postCommentRepository.findById(commentId);
      if (!comment) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      if (comment.commentType !== PostCommentType.PUBLIC) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      const post = await this.postRepository.findVisibleById(
        comment.postId,
        campusId,
        currentUser,
      );
      if (!post) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      if (comment.userId !== currentUser.id) {
        throw new ForbiddenException("You can only edit your own comments");
      }

      comment.updateContent(input.content);

      const updatedComment = await this.postCommentRepository.update(comment);

      this.logger.log(`Comment updated: ${updatedComment.id}`);
      return updatedComment;
    } catch (error) {
      this.logger.error(
        `Failed to update comment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
