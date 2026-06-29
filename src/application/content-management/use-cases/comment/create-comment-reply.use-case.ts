import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { PostRepository } from "../../ports/post.repository";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { PostComment } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

export interface CreateCommentReplyInput {
  parentCommentId: string;
  campusId: string;
  content: string;
}

@Injectable()
export class CreateCommentReplyUseCase {
  private readonly logger = new Logger(CreateCommentReplyUseCase.name);

  constructor(
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  async execute(
    input: CreateCommentReplyInput,
    currentUser: User,
  ): Promise<PostComment> {
    try {
      this.logger.log(
        `Creating reply to comment: ${input.parentCommentId} by user: ${currentUser.id}`,
      );

      const parentComment = await this.postCommentRepository.findById(
        input.parentCommentId,
      );
      if (!parentComment) {
        throw new NotFoundException(
          `Comment with ID ${input.parentCommentId} not found`,
        );
      }

      const post = await this.postRepository.findById(parentComment.postId);
      if (!post) {
        throw new NotFoundException(
          `Post with ID ${parentComment.postId} not found`,
        );
      }

      if (post.campusId !== input.campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      const setting = await this.campusSettingRepository.findByCampusId(
        input.campusId,
      );
      if (setting && !setting.allowParentComments) {
        throw new ForbiddenException("Comments are disabled for this campus");
      }

      if (!post.canReceiveEngagement()) {
        throw new BadRequestException(
          "Cannot reply to this post. Post must be published and not deleted.",
        );
      }

      if (parentComment.isDeleted) {
        throw new BadRequestException("Cannot reply to a deleted comment");
      }

      if (!parentComment.canReply()) {
        throw new BadRequestException(
          "Cannot reply to this comment. Maximum nesting depth reached.",
        );
      }

      const reply = PostComment.create({
        postId: parentComment.postId,
        userId: currentUser.id,
        content: input.content,
        depth: parentComment.depth + 1,
        parentCommentId: parentComment.id,
      });

      const savedReply = await this.postCommentRepository.save(reply);

      this.logger.log(`Reply created: ${savedReply.id}`);
      return savedReply;
    } catch (error) {
      this.logger.error(
        `Failed to create reply: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
