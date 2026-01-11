import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
} from "@nestjs/common";
import { AttachmentRepository } from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";
import { User } from "@/domain/user-management/user.entity";

export interface ReorderAttachmentsInput {
  postId: string;
  campusId: string;
  orders: { id: string; order: number }[];
}

@Injectable()
export class ReorderAttachmentsUseCase {
  private readonly logger = new Logger(ReorderAttachmentsUseCase.name);

  constructor(
    @Inject("ATTACHMENT_REPOSITORY")
    private readonly attachmentRepository: AttachmentRepository,
    @Inject("POST_REPOSITORY")
    private readonly postRepository: PostRepository,
  ) {}

  async execute(
    input: ReorderAttachmentsInput,
    currentUser: User,
  ): Promise<void> {
    try {
      this.logger.log(`Reordering attachments for post: ${input.postId}`);
      const post = await this.postRepository.findById(input.postId);

      if (!post) {
        throw new NotFoundException(`Post with ID ${input.postId} not found`);
      }

      // Verify the post belongs to the specified campus
      if (post.campusId !== input.campusId) {
        throw new ForbiddenException(
          "You do not have access to this post in the specified campus",
        );
      }

      const isAuthor = post.authorId.toString() === currentUser.id.toString();
      const isAdmin = currentUser.roles?.some((role) => role.name === "Admin");

      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException(
          "You are not authorized to reorder attachments for this post",
        );
      }

      const attachments = await this.attachmentRepository.findByPostId(
        input.postId,
      );
      if (attachments.length !== input.orders.length) {
        throw new BadRequestException(
          "The number of attachments in the request does not match the number of attachments for the post.",
        );
      }

      const attachmentIds = attachments.map((att) => att.id.toString());
      const orderIds = input.orders.map((order) => order.id);
      if (!orderIds.every((id) => attachmentIds.includes(id))) {
        throw new BadRequestException(
          "Some attachment ids in the request do not belong to the post.",
        );
      }

      await this.attachmentRepository.updateOrder(input.postId, input.orders);
      this.logger.log(`Attachments reordered for post: ${input.postId}`);
    } catch (error) {
      this.logger.error(
        `Failed to reorder attachments: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
