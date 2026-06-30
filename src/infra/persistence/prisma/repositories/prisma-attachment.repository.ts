import { Injectable } from "@nestjs/common";
import { AttachmentRepository } from "@/application/content-management/ports/attachment.repository";
import { Attachment } from "@/domain/content-management";
import { PrismaService } from "../prisma.service";
import { PrismaAttachmentMapper } from "../mapper/prisma-attachment.mapper";

@Injectable()
export class PrismaAttachmentRepository implements AttachmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(attachment: Attachment): Promise<Attachment> {
    const prismaAttachment = PrismaAttachmentMapper.toPrisma(attachment);
    const createdAttachment = await this.prisma.attachment.create({
      data: prismaAttachment,
    });
    return PrismaAttachmentMapper.toDomain(createdAttachment);
  }

  async appendToPost(attachment: Attachment): Promise<Attachment> {
    const prismaAttachment = PrismaAttachmentMapper.toPrisma(attachment);
    const createdAttachment = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM post WHERE id = ${attachment.postId}::uuid FOR UPDATE`;
      const maxOrder = await tx.attachment.aggregate({
        where: { postId: attachment.postId },
        _max: { order: true },
      });

      return tx.attachment.create({
        data: {
          ...prismaAttachment,
          order: (maxOrder._max.order ?? -1) + 1,
        },
        include: { file: true },
      });
    });
    return PrismaAttachmentMapper.toDomain(createdAttachment);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.attachment.delete({ where: { id } });
  }

  async removeAndCompact(postId: string, attachmentId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM post WHERE id = ${postId}::uuid FOR UPDATE`;
      const deleted = await tx.attachment.deleteMany({
        where: { id: attachmentId, postId },
      });
      if (deleted.count !== 1) {
        throw new Error("Attachment not found for this post");
      }

      const remaining = await tx.attachment.findMany({
        where: { postId },
        orderBy: { order: "asc" },
      });

      for (const [index, attachment] of remaining.entries()) {
        await tx.attachment.updateMany({
          where: { id: attachment.id, postId },
          data: { order: -(index + 1) },
        });
      }

      for (const [index, attachment] of remaining.entries()) {
        await tx.attachment.updateMany({
          where: { id: attachment.id, postId },
          data: { order: index },
        });
      }
    });
  }

  async findByPostId(postId: string): Promise<Attachment[]> {
    const attachments = await this.prisma.attachment.findMany({
      where: { postId },
      include: { file: true },
      orderBy: { order: "asc" },
    });
    return attachments.map(PrismaAttachmentMapper.toDomain);
  }

  async updateOrder(
    postId: string,
    orders: { id: string; order: number }[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM post WHERE id = ${postId}::uuid FOR UPDATE`;
      for (const [index, item] of orders.entries()) {
        const result = await tx.attachment.updateMany({
          where: { id: item.id, postId },
          data: { order: -(index + 1) },
        });
        if (result.count !== 1) {
          throw new Error(`Attachment ${item.id} not found for post ${postId}`);
        }
      }

      for (const item of orders) {
        const result = await tx.attachment.updateMany({
          where: { id: item.id, postId },
          data: { order: item.order },
        });
        if (result.count !== 1) {
          throw new Error(`Attachment ${item.id} not found for post ${postId}`);
        }
      }
    });
  }
}
