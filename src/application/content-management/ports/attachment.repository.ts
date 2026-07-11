import { Attachment, PostStatus } from "@/domain/content-management";

export interface AttachmentMutationContext {
  changedById: string;
  reason: string;
  canAttachAnyFile?: boolean;
}

export interface AttachmentOrderState {
  id: string;
  order: number;
}

export class AttachmentMutationStateError extends Error {
  constructor(public readonly currentStatus: PostStatus) {
    super(
      `Cannot modify attachments while post status is ${currentStatus}. Move the post to DRAFT before changing attachments.`,
    );
    this.name = AttachmentMutationStateError.name;
  }
}

export class AttachmentMutationPostNotFoundError extends Error {
  constructor(public readonly postId: string) {
    super(`Post with ID ${postId} not found`);
    this.name = AttachmentMutationPostNotFoundError.name;
  }
}

export class AttachmentNotFoundForPostError extends Error {
  constructor(
    public readonly attachmentId: string,
    public readonly postId: string,
  ) {
    super(`Attachment ${attachmentId} not found for post ${postId}`);
    this.name = AttachmentNotFoundForPostError.name;
  }
}

export class AttachmentOrderConflictError extends Error {
  constructor(public readonly currentOrders: AttachmentOrderState[]) {
    super("The post attachment set changed before the reorder was applied.");
    this.name = AttachmentOrderConflictError.name;
  }
}

export type AttachmentFileIntegrityReason =
  | "NOT_FOUND"
  | "CAMPUS_MISMATCH"
  | "UNAVAILABLE"
  | "INVALID_PURPOSE"
  | "NOT_OWNED";

const ATTACHMENT_FILE_INTEGRITY_MESSAGES: Record<
  AttachmentFileIntegrityReason,
  string
> = {
  NOT_FOUND: "File not found",
  CAMPUS_MISMATCH: "File must belong to the same campus as the post",
  UNAVAILABLE: "File must be available to be attached to a post",
  INVALID_PURPOSE: "Only files uploaded for post attachments can be attached",
  NOT_OWNED:
    "Only the uploader or a user with post.manage can attach this file",
};

export class AttachmentFileIntegrityError extends Error {
  constructor(
    public readonly fileId: string,
    public readonly reason: AttachmentFileIntegrityReason,
  ) {
    super(
      reason === "NOT_FOUND"
        ? `File with ID ${fileId} not found`
        : ATTACHMENT_FILE_INTEGRITY_MESSAGES[reason],
    );
    this.name = AttachmentFileIntegrityError.name;
  }
}

export abstract class AttachmentRepository {
  abstract create(attachment: Attachment): Promise<Attachment>;
  abstract appendToPost(
    attachment: Attachment,
    context: AttachmentMutationContext,
  ): Promise<Attachment>;
  abstract delete(id: string): Promise<void>;
  abstract removeAndCompact(
    postId: string,
    attachmentId: string,
    context: AttachmentMutationContext,
  ): Promise<void>;
  abstract findByPostId(postId: string): Promise<Attachment[]>;
  abstract updateOrder(
    postId: string,
    orders: AttachmentOrderState[],
    context: AttachmentMutationContext,
  ): Promise<void>;
}
