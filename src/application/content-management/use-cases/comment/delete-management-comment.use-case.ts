import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PostRepository } from "../../ports/post.repository";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { PostCommentType } from "@/domain/content-management/entities/post-comment.entity";
import { User } from "@/domain/user-management/user.entity";

@Injectable()
export class DeleteManagementCommentUseCase {
  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async execute(
    postId: string,
    commentId: string,
    campusId: string,
    currentUser: User,
  ): Promise<void> {
    const [post, comment] = await Promise.all([
      this.postRepository.findById(postId),
      this.postCommentRepository.findById(commentId),
    ]);

    if (!post || post.isDeleted) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.campusId !== campusId) {
      throw new ForbiddenException("Post does not belong to the active campus");
    }

    if (
      !comment ||
      comment.postId !== postId ||
      comment.commentType !== PostCommentType.MANAGEMENT
    ) {
      throw new NotFoundException(
        `Management note with ID ${commentId} not found`,
      );
    }

    await this.postCommentRepository.softDelete(commentId, currentUser.id);
  }
}
