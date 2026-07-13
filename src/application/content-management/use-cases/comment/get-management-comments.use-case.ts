import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";

import { PostRepository } from "../../ports/post.repository";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { PostComment } from "@/domain/content-management";

@Injectable()
export class GetManagementCommentsUseCase {
  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async execute(postId: string, campusId: string): Promise<PostComment[]> {
    const post = await this.postRepository.findById(postId);
    if (!post || post.isDeleted) {
      throw new NotFoundException(`Post with ID ${postId} not found`);
    }

    if (post.campusId !== campusId) {
      throw new ForbiddenException("Post does not belong to the active campus");
    }

    return this.postCommentRepository.findManagementNotesByPostId(postId);
  }
}
