import { Attachment as PrismaAttachment, Prisma } from "@prisma/client";
import { Attachment } from "@/domain/content-management";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

export class PrismaAttachmentMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaAttachment: PrismaAttachment): Attachment {
    return Attachment.create(
      {
        postId: prismaAttachment.postId,
        fileId: prismaAttachment.fileId,
        comment: prismaAttachment.comment,
        order: prismaAttachment.order,
        createdAt: prismaAttachment.createdAt,
        updatedAt: prismaAttachment.updatedAt,
      },
      prismaAttachment.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaAttachment: PrismaAttachment): Attachment {
    return PrismaAttachmentMapper.toDomain(prismaAttachment);
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    attachment: Attachment,
  ): Prisma.AttachmentUncheckedCreateInput {
    return {
      id: attachment.id,
      postId: attachment.postId,
      fileId: attachment.fileId,
      comment: attachment.comment ?? null,
      order: attachment.order,
      createdAt: attachment.createdAt,
      updatedAt: attachment.updatedAt ?? new Date(),
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(attachment: Attachment): Prisma.AttachmentUpdateInput {
    return {
      comment: attachment.comment ?? null,
      order: attachment.order,
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
