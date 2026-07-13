import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { AttachmentRepository } from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";
import { User } from "@/domain/user-management/user.entity";
import { userCanManagePost } from "./authorization/post-permission.helper";
import {
  assertAttachmentMutationAllowed,
  rethrowAttachmentMutationError,
} from "./attachment-workflow.helper";

@Injectable()
export class RemoveAttachmentUseCase {
  private readonly logger = new Logger(RemoveAttachmentUseCase.name);

  constructor(
    @Inject("ATTACHMENT_REPOSITORY")
    private readonly attachmentRepository: AttachmentRepository,
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    campusId: string,
    postId: string,
    attachmentId: string,
    currentUser: User,
  ): Promise<void> {
    try {
      this.logger.log(
        `Removing attachment ${attachmentId} from post ${postId}`,
      );
      const post = await this.postRepository.findById(postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${postId} not found`);
      }

      // Verify the post belongs to the specified campus
      if (post.campusId !== campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      if (!userCanManagePost(currentUser, campusId, post.authorId.toString())) {
        throw new ForbiddenException(
          "You are not authorized to remove attachments from this post",
        );
      }

      assertAttachmentMutationAllowed(post);

      await this.attachmentRepository.removeAndCompact(postId, attachmentId, {
        changedById: currentUser.id,
        reason: "Attachment removed",
      });
      this.logger.log(
        `Attachment removed and order compacted: ${attachmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to remove attachment: ${error.message}`,
        error.stack,
      );
      rethrowAttachmentMutationError(error);
    }
  }
}
