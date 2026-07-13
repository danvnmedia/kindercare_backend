import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  AttachmentFileIntegrityError,
  AttachmentMutationContext,
  AttachmentMutationPostNotFoundError,
  AttachmentMutationStateError,
  AttachmentNotFoundForPostError,
  AttachmentOrderConflictError,
  AttachmentOrderState,
  AttachmentRepository,
} from "@/application/content-management/ports/attachment.repository";
import { Attachment, PostStatus } from "@/domain/content-management";
import { FilePurpose } from "@/domain/file-management/enums/file-purpose.enum";
import { FileStatus } from "@/domain/file-management/enums/file-status.enum";
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

  async appendToPost(
    attachment: Attachment,
    context: AttachmentMutationContext,
  ): Promise<Attachment> {
    const prismaAttachment = PrismaAttachmentMapper.toPrisma(attachment);
    const createdAttachment = await this.prisma.$transaction(async (tx) => {
      const post = await this.preparePostForAttachmentMutation(
        tx,
        attachment.postId,
        context,
      );
      await this.assertFileCanBeAttached(
        tx,
        attachment.fileId,
        post.campusId,
        context,
      );
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

  async removeAndCompact(
    postId: string,
    attachmentId: string,
    context: AttachmentMutationContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.preparePostForAttachmentMutation(tx, postId, context);
      const deleted = await tx.attachment.deleteMany({
        where: { id: attachmentId, postId },
      });
      if (deleted.count !== 1) {
        throw new AttachmentNotFoundForPostError(attachmentId, postId);
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
    orders: AttachmentOrderState[],
    context: AttachmentMutationContext,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.preparePostForAttachmentMutation(tx, postId, context);
      const currentAttachments = await tx.attachment.findMany({
        where: { postId },
        select: { id: true, order: true },
        orderBy: { order: "asc" },
      });
      if (!this.isAuthoritativeOrder(currentAttachments, orders)) {
        throw new AttachmentOrderConflictError(currentAttachments);
      }

      for (const [index, item] of orders.entries()) {
        const result = await tx.attachment.updateMany({
          where: { id: item.id, postId },
          data: { order: -(index + 1) },
        });
        if (result.count !== 1) {
          throw new AttachmentOrderConflictError(currentAttachments);
        }
      }

      for (const item of orders) {
        const result = await tx.attachment.updateMany({
          where: { id: item.id, postId },
          data: { order: item.order },
        });
        if (result.count !== 1) {
          throw new AttachmentOrderConflictError(currentAttachments);
        }
      }
    });
  }

  private async preparePostForAttachmentMutation(
    tx: Prisma.TransactionClient,
    postId: string,
    context: AttachmentMutationContext,
  ): Promise<{ status: string; campusId: string }> {
    await tx.$queryRaw`SELECT id FROM post WHERE id = ${postId}::uuid FOR UPDATE`;
    const post = await tx.post.findFirst({
      where: { id: postId, isDeleted: false },
      select: { status: true, campusId: true },
    });

    if (!post) {
      throw new AttachmentMutationPostNotFoundError(postId);
    }

    const currentStatus = post.status as PostStatus;
    if (
      currentStatus === PostStatus.PENDING_REVIEW ||
      currentStatus === PostStatus.ARCHIVED
    ) {
      throw new AttachmentMutationStateError(currentStatus);
    }

    if (currentStatus !== PostStatus.PUBLISHED) {
      return post;
    }

    await tx.post.update({
      where: { id: postId },
      data: {
        status: PostStatus.DRAFT,
        publishAt: null,
        isPinned: false,
        pinnedById: null,
        pinnedUntil: null,
      },
    });
    await tx.postHistoryStatus.create({
      data: {
        postId,
        changedById: context.changedById,
        previousStatus: PostStatus.PUBLISHED,
        newStatus: PostStatus.DRAFT,
        reason: `${context.reason}; published post requires resubmission`,
      },
    });
    return post;
  }

  private async assertFileCanBeAttached(
    tx: Prisma.TransactionClient,
    fileId: string,
    postCampusId: string,
    context: AttachmentMutationContext,
  ): Promise<void> {
    await tx.$queryRaw`SELECT id FROM file WHERE id = ${fileId}::uuid FOR UPDATE`;
    const file = await tx.file.findUnique({
      where: { id: fileId },
      select: {
        campusId: true,
        status: true,
        purpose: true,
        uploadedBy: true,
        isDeleted: true,
      },
    });

    if (!file || file.isDeleted) {
      throw new AttachmentFileIntegrityError(fileId, "NOT_FOUND");
    }
    if (file.campusId !== postCampusId) {
      throw new AttachmentFileIntegrityError(fileId, "CAMPUS_MISMATCH");
    }
    if (
      file.status !== FileStatus.UPLOADED &&
      file.status !== FileStatus.PROCESSED
    ) {
      throw new AttachmentFileIntegrityError(fileId, "UNAVAILABLE");
    }
    if (file.purpose !== FilePurpose.POST_ATTACHMENT) {
      throw new AttachmentFileIntegrityError(fileId, "INVALID_PURPOSE");
    }
    if (file.uploadedBy !== context.changedById && !context.canAttachAnyFile) {
      throw new AttachmentFileIntegrityError(fileId, "NOT_OWNED");
    }
  }

  private isAuthoritativeOrder(
    current: AttachmentOrderState[],
    requested: AttachmentOrderState[],
  ): boolean {
    if (current.length !== requested.length) {
      return false;
    }

    const currentIds = new Set(current.map(({ id }) => id));
    const requestedIds = requested.map(({ id }) => id);
    if (
      new Set(requestedIds).size !== requestedIds.length ||
      requestedIds.some((id) => !currentIds.has(id))
    ) {
      return false;
    }

    const sortedOrders = requested
      .map(({ order }) => order)
      .sort((a, b) => a - b);
    return sortedOrders.every(
      (order, index) => Number.isInteger(order) && order === index,
    );
  }
}
