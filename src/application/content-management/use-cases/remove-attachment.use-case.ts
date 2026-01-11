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

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "You are not authorized to remove attachments from this post",
        );
      }

      await this.attachmentRepository.delete(attachmentId);
      this.logger.log(`Attachment removed: ${attachmentId}`);

      // Reorder remaining attachments
      const remainingAttachments =
        await this.attachmentRepository.findByPostId(postId);
      const reorderPromises = remainingAttachments
        .sort((a, b) => a.order - b.order)
        .map((att, index) => ({ id: att.id.toString(), order: index }));

      if (reorderPromises.length > 0) {
        await this.attachmentRepository.updateOrder(postId, reorderPromises);
        this.logger.log(`Reordered attachments for post ${postId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to remove attachment: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
