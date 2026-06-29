import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PostRepository } from "../../ports/post.repository";
import { PostCommentRepository } from "../../ports/post-comment.repository";
import { CampusSettingRepository } from "../../ports/campus-setting.repository";
import { PostComment } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";

export interface CreatePostCommentInput {
  postId: string;
  campusId: string;
  content: string;
}

@Injectable()
export class CreatePostCommentUseCase {
  private readonly logger = new Logger(CreatePostCommentUseCase.name);

  constructor(
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
    @Inject("POST_COMMENT_REPOSITORY")
    private readonly postCommentRepository: PostCommentRepository,
    @Inject("CAMPUS_SETTING_REPOSITORY")
    private readonly campusSettingRepository: CampusSettingRepository,
  ) {}

  async execute(
    input: CreatePostCommentInput,
    currentUser: User,
  ): Promise<PostComment> {
    try {
      this.logger.log(
        `Creating comment on post: ${input.postId} by user: ${currentUser.id}`,
      );

      const post = await this.postRepository.findById(input.postId);
      if (!post) {
        throw new NotFoundException(`Post with ID ${input.postId} not found`);
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
          "Cannot comment on this post. Post must be published and not deleted.",
        );
      }

      const comment = PostComment.create({
        postId: input.postId,
        userId: currentUser.id,
        content: input.content,
        depth: 0,
        parentCommentId: null,
      });

      const savedComment = await this.postCommentRepository.save(comment);

      this.logger.log(`Comment created: ${savedComment.id}`);
      return savedComment;
    } catch (error) {
      this.logger.error(
        `Failed to create comment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
