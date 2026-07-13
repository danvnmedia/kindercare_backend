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
import { userHasPostPermission } from "../authorization/post-permission.helper";

@Injectable()
export class DeletePostCommentUseCase {
  private readonly logger = new Logger(DeletePostCommentUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async execute(
    commentId: string,
    campusId: string,
    currentUser: User,
  ): Promise<void> {
    try {
      this.logger.log(
        `Deleting comment: ${commentId} by user: ${currentUser.id}`,
      );

      const comment = await this.postCommentRepository.findById(commentId);
      if (!comment) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      if (comment.commentType !== PostCommentType.PUBLIC) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      if (comment.isDeleted) {
        this.logger.log(`Comment ${commentId} already deleted`);
        return;
      }

      const post = await this.postRepository.findVisibleById(
        comment.postId,
        campusId,
        currentUser,
      );
      if (!post) {
        throw new NotFoundException(`Comment with ID ${commentId} not found`);
      }

      const canDelete = this.checkDeletePermission(
        comment,
        currentUser,
        post.authorId,
        campusId,
      );
      if (!canDelete) {
        throw new ForbiddenException(
          "You do not have permission to delete this comment",
        );
      }

      comment.softDelete(currentUser.id);
      await this.postCommentRepository.update(comment);

      this.logger.log(`Comment deleted: ${commentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete comment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  private checkDeletePermission(
    comment: PostComment,
    user: User,
    postAuthorId: string,
    campusId: string,
  ): boolean {
    // Comment owner can delete
    if (comment.userId === user.id) {
      return true;
    }

    if (userHasPostPermission(user, campusId, "post.manage")) {
      return true;
    }

    // Post author can delete any comment on their post
    if (postAuthorId === user.id) {
      return true;
    }

    return false;
  }
}
