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
import { userHasPostPermission } from "./authorization/post-permission.helper";

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
      const canUpdate = userHasPostPermission(
        currentUser,
        input.campusId,
        "post.update",
      );

      if (!isAuthor && !canUpdate) {
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
      const attachmentIdSet = new Set(attachmentIds);
      const orderIds = input.orders.map((order) => order.id);
      const orderIdSet = new Set(orderIds);

      if (orderIdSet.size !== orderIds.length) {
        throw new BadRequestException("Attachment ids must be unique.");
      }

      if (
        orderIdSet.size !== attachmentIdSet.size ||
        orderIds.some((id) => !attachmentIdSet.has(id))
      ) {
        throw new BadRequestException(
          "Some attachment ids in the request do not belong to the post.",
        );
      }

      const requestedOrders = input.orders.map((item) => item.order);
      if (new Set(requestedOrders).size !== requestedOrders.length) {
        throw new BadRequestException("Attachment orders must be unique.");
      }

      const sortedOrders = [...requestedOrders].sort((a, b) => a - b);
      const isContiguousZeroBased = sortedOrders.every(
        (order, index) => Number.isInteger(order) && order === index,
      );
      if (!isContiguousZeroBased) {
        throw new BadRequestException(
          "Attachment orders must be contiguous and zero-based.",
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
