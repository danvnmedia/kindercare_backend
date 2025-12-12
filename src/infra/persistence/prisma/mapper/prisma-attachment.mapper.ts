import { Attachment as PrismaAttachment, Prisma } from "@prisma/client";
import { Attachment } from "@/domain/content-management";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

export class PrismaAttachmentMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaAttachment: PrismaAttachment): Attachment {
    const attachmentProps = {
      postId: new UniqueEntityID(prismaAttachment.postId),
      fileId: new UniqueEntityID(prismaAttachment.fileId),
      comment: prismaAttachment.comment,
      order: prismaAttachment.order,
      createdAt: prismaAttachment.createdAt,
      updatedAt: prismaAttachment.updatedAt,
    };
    return Attachment.create(
      attachmentProps,
      new UniqueEntityID(prismaAttachment.id),
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaAttachment: PrismaAttachment): Attachment {
    const attachmentProps = {
      postId: new UniqueEntityID(prismaAttachment.postId),
      fileId: new UniqueEntityID(prismaAttachment.fileId),
      comment: prismaAttachment.comment,
      order: prismaAttachment.order,
      createdAt: prismaAttachment.createdAt,
      updatedAt: prismaAttachment.updatedAt,
    };
    return Attachment.create(
      attachmentProps,
      new UniqueEntityID(prismaAttachment.id),
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    attachment: Attachment,
  ): Prisma.AttachmentUncheckedCreateInput {
    return {
      id: attachment.id.toString(),
      postId: attachment.postId.toString(),
      fileId: attachment.fileId.toString(),
      comment: attachment.comment ?? null,
      order: attachment.order,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt ?? new Date(),
    };
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaAttachments: PrismaAttachment[]): Attachment[] {
    return prismaAttachments.map((prismaAttachment) =>
      PrismaAttachmentMapper.toDomain(prismaAttachment),
    );
  }
}
