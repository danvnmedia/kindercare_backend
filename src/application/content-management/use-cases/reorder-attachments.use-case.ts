import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { AttachmentRepository } from "../ports/attachment.repository";
import { PostRepository } from "../ports/post.repository";
import { Post } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { userCanManagePost } from "./authorization/post-permission.helper";
import {
  assertAttachmentMutationAllowed,
  rethrowAttachmentMutationError,
} from "./attachment-workflow.helper";

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
  ): Promise<Post> {
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

      if (
        !userCanManagePost(
          currentUser,
          input.campusId,
          post.authorId.toString(),
        )
      ) {
        throw new ForbiddenException(
          "You are not authorized to reorder attachments for this post",
        );
      }

      assertAttachmentMutationAllowed(post);

      const attachments = await this.attachmentRepository.findByPostId(
        input.postId,
      );
      const currentOrders = attachments.map(({ id, order }) => ({
        id: id.toString(),
        order,
      }));
      if (attachments.length !== input.orders.length) {
        throw new ConflictException({
          message:
            "The request must contain the complete current attachment set.",
          currentOrders,
        });
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
        throw new ConflictException({
          message:
            "The request must contain the complete current attachment set.",
          currentOrders,
        });
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

      await this.attachmentRepository.updateOrder(input.postId, input.orders, {
        changedById: currentUser.id,
        reason: "Attachments reordered",
      });
      const resultingPost = await this.postRepository.findById(input.postId);
      if (!resultingPost) {
        throw new NotFoundException(`Post with ID ${input.postId} not found`);
      }
      this.logger.log(`Attachments reordered for post: ${input.postId}`);
      return resultingPost;
    } catch (error) {
      this.logger.error(
        `Failed to reorder attachments: ${error.message}`,
        error.stack,
      );
      rethrowAttachmentMutationError(error);
    }
  }
}
