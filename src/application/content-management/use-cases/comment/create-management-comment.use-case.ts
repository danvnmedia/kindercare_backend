import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PostRepository } from "../../ports/post.repository";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { PostComment } from "@/domain/content-management";
import { PostCommentType } from "@/domain/content-management/entities/post-comment.entity";
import { User } from "@/domain/user-management/user.entity";

export interface CreateManagementCommentInput {
  postId: string;
  campusId: string;
  content: string;
}

@Injectable()
export class CreateManagementCommentUseCase {
  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
  ) {}

  async execute(
    input: CreateManagementCommentInput,
    currentUser: User,
  ): Promise<PostComment> {
    const post = await this.postRepository.findById(input.postId);
    if (!post || post.isDeleted) {
      throw new NotFoundException(`Post with ID ${input.postId} not found`);
    }

    if (post.campusId !== input.campusId) {
      throw new ForbiddenException("Post does not belong to the active campus");
    }

    if (!input.content?.trim()) {
      throw new BadRequestException("Management note content is required");
    }

    const comment = PostComment.create({
      postId: input.postId,
      userId: currentUser.id,
      content: input.content,
      depth: 0,
      parentCommentId: null,
      commentType: PostCommentType.MANAGEMENT,
    });

    return this.postCommentRepository.save(comment);
  }
}
