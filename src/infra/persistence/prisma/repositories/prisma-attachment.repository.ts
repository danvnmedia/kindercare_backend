import { Injectable } from "@nestjs/common";
import { AttachmentRepository } from "@/application/content-management/ports/attachment.repository";
import { Attachment } from "@/domain/content-management";
import { PrismaService } from "../prisma.service";
import { PrismaAttachmentMapper } from "../mapper/prisma-attachment.mapper";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

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

  async delete(id: string): Promise<void> {
    await this.prisma.attachment.delete({ where: { id } });
  }

  async findByPostId(postId: string): Promise<Attachment[]> {
    const attachments = await this.prisma.attachment.findMany({
      where: { postId },
    });
    return attachments.map(PrismaAttachmentMapper.toDomain);
  }

  async updateOrder(
    postId: string,
    orders: { id: string; order: number }[],
  ): Promise<void> {
    const updates = orders.map((order) =>
      this.prisma.attachment.update({
        where: { id: order.id },
        data: { order: order.order },
      }),
    );
    await this.prisma.$transaction(updates);
  }
}
