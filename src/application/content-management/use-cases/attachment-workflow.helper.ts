import {
  AttachmentFileIntegrityError,
  AttachmentMutationPostNotFoundError,
  AttachmentMutationStateError,
  AttachmentNotFoundForPostError,
  AttachmentOrderConflictError,
} from "../ports/attachment.repository";
import { Post, PostStatus } from "@/domain/content-management";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";

export function assertAttachmentMutationAllowed(post: Post): void {
  if (
    post.status === PostStatus.PENDING_REVIEW ||
    post.status === PostStatus.ARCHIVED
  ) {
    throwAttachmentStateError(post.status);
  }
}

export function rethrowAttachmentMutationError(error: unknown): never {
  if (error instanceof AttachmentMutationStateError) {
    throwAttachmentStateError(error.currentStatus);
  }
  if (error instanceof AttachmentMutationPostNotFoundError) {
    throw new NotFoundException(error.message);
  }
  if (error instanceof AttachmentNotFoundForPostError) {
    throw new NotFoundException(error.message);
  }
  if (error instanceof AttachmentOrderConflictError) {
    throw new ConflictException({
      message: error.message,
      currentOrders: error.currentOrders,
    });
  }
  if (error instanceof AttachmentFileIntegrityError) {
    if (error.reason === "NOT_FOUND") {
      throw new NotFoundException(error.message);
    }
    if (error.reason === "NOT_OWNED") {
      throw new ForbiddenException(error.message);
    }
    throw new BadRequestException(error.message);
  }
  throw error;
}

function throwAttachmentStateError(currentStatus: PostStatus): never {
  throw new BadRequestException({
    message: `Cannot modify attachments while post status is ${currentStatus}. Move the post to DRAFT before changing attachments.`,
    currentStatus,
    requiredStatus: PostStatus.DRAFT,
  });
}
