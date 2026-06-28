import { PostCommentRepository } from "@/application/content-management/ports/post-comment.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PostComment } from "@/domain/content-management";
import { Injectable } from "@nestjs/common";
import { PrismaPostCommentMapper } from "../mapper/prisma-post-comment.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaPostCommentRepository implements PostCommentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<PostComment | null> {
    const prismaComment = await this.prisma.postComment.findUnique({
      where: { id },
    });
    return prismaComment
      ? PrismaPostCommentMapper.toDomain(prismaComment)
      : null;
  }

  async findByPostId(
    postId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostComment>> {
    params.allowedFilterFields = ["userId", "isDeleted", "depth"];
    params.allowedSortFields = ["createdAt", "updatedAt"];

    return await this.queryService.executeQuery<PostComment>(
      this.prisma,
      "postComment",
      params,
      {
        where: { postId },
        orderBy: { createdAt: "asc" },
      },
      PrismaPostCommentMapper,
    );
  }

  async findRootCommentsByPostId(
    postId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostComment>> {
    params.allowedFilterFields = ["userId", "isDeleted"];
    params.allowedSortFields = ["createdAt", "updatedAt"];

    return await this.queryService.executeQuery<PostComment>(
      this.prisma,
      "postComment",
      params,
      {
        where: {
          postId,
          parentCommentId: null,
          depth: 0,
        },
        orderBy: { createdAt: "asc" },
      },
      PrismaPostCommentMapper,
    );
  }

  async findRepliesByCommentId(commentId: string): Promise<PostComment[]> {
    const prismaComments = await this.prisma.postComment.findMany({
      where: {
        parentCommentId: commentId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    return PrismaPostCommentMapper.toDomainArray(prismaComments);
  }

  async countByPost(postId: string): Promise<number> {
    return await this.prisma.postComment.count({
      where: { postId },
    });
  }

  async countActiveByPost(postId: string): Promise<number> {
    return await this.prisma.postComment.count({
      where: {
        postId,
        isDeleted: false,
      },
    });
  }

  async save(comment: PostComment): Promise<PostComment> {
    const prismaData = PrismaPostCommentMapper.toPrisma(comment);
    const created = await this.prisma.postComment.create({
      data: prismaData,
    });
    return PrismaPostCommentMapper.toDomain(created);
  }

  async update(comment: PostComment): Promise<PostComment> {
    const prismaData = PrismaPostCommentMapper.toPrismaUpdate(comment);
    const updated = await this.prisma.postComment.update({
      where: { id: comment.id },
      data: prismaData,
    });
    return PrismaPostCommentMapper.toDomain(updated);
  }

  async softDelete(id: string, deletedById: string): Promise<void> {
    await this.prisma.postComment.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: { connect: { id: deletedById } },
      },
    });
  }
}
