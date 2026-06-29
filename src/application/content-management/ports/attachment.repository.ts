import { Attachment } from "@/domain/content-management";

export abstract class AttachmentRepository {
  abstract create(attachment: Attachment): Promise<Attachment>;
  abstract appendToPost(attachment: Attachment): Promise<Attachment>;
  abstract delete(id: string): Promise<void>;
  abstract removeAndCompact(
    postId: string,
    attachmentId: string,
  ): Promise<void>;
  abstract findByPostId(postId: string): Promise<Attachment[]>;
  abstract updateOrder(
    postId: string,
    orders: { id: string; order: number }[],
  ): Promise<void>;
}
