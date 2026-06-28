import { PostApprovalRequestRepository } from "@/application/content-management/ports/post-approval-request.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  PostApprovalRequest,
  ApprovalStatus,
} from "@/domain/content-management";
import { Injectable } from "@nestjs/common";
import { PrismaPostApprovalRequestMapper } from "../mapper/prisma-post-approval-request.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaPostApprovalRequestRepository
  implements PostApprovalRequestRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<PostApprovalRequest | null> {
    const prismaRequest = await this.prisma.postApprovalRequest.findUnique({
      where: { id },
      include: {
        submittedBy: true,
        reviewedBy: true,
      },
    });
    return prismaRequest
      ? PrismaPostApprovalRequestMapper.toDomain(prismaRequest)
      : null;
  }

  async findByPostId(postId: string): Promise<PostApprovalRequest[]> {
    const prismaRequests = await this.prisma.postApprovalRequest.findMany({
      where: { postId },
      include: {
        submittedBy: true,
        reviewedBy: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    });
    return PrismaPostApprovalRequestMapper.toDomainArray(prismaRequests);
  }

  async findLatestByPostId(
    postId: string,
  ): Promise<PostApprovalRequest | null> {
    const prismaRequest = await this.prisma.postApprovalRequest.findFirst({
      where: { postId },
      include: {
        submittedBy: true,
        reviewedBy: true,
      },
      orderBy: {
        submittedAt: "desc",
      },
    });
    return prismaRequest
      ? PrismaPostApprovalRequestMapper.toDomain(prismaRequest)
      : null;
  }

  async findPendingByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostApprovalRequest>> {
    params.allowedFilterFields = ["submittedById"];
    params.allowedSortFields = ["submittedAt", "createdAt"];

    // First get post IDs for this campus
    const postIds = await this.prisma.post.findMany({
      where: { campusId },
      select: { id: true },
    });
    const campusPostIds = postIds.map((p) => p.id);

    return await this.queryService.executeQuery<PostApprovalRequest>(
      this.prisma,
      "postApprovalRequest",
      params,
      {
        where: {
          postId: { in: campusPostIds },
          status: ApprovalStatus.PENDING,
        },
        include: {
          submittedBy: true,
          reviewedBy: true,
        },
        orderBy: { submittedAt: "desc" },
      },
      PrismaPostApprovalRequestMapper,
    );
  }

  async findByCampusAndStatus(
    campusId: string,
    status: ApprovalStatus,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostApprovalRequest>> {
    params.allowedFilterFields = ["submittedById", "reviewedById"];
    params.allowedSortFields = ["submittedAt", "reviewedAt", "createdAt"];

    // First get post IDs for this campus
    const postIds = await this.prisma.post.findMany({
      where: { campusId },
      select: { id: true },
    });
    const campusPostIds = postIds.map((p) => p.id);

    return await this.queryService.executeQuery<PostApprovalRequest>(
      this.prisma,
      "postApprovalRequest",
      params,
      {
        where: {
          postId: { in: campusPostIds },
          status,
        },
        include: {
          submittedBy: true,
          reviewedBy: true,
        },
        orderBy: { submittedAt: "desc" },
      },
      PrismaPostApprovalRequestMapper,
    );
  }

  async countPendingByCampus(campusId: string): Promise<number> {
    // First get post IDs for this campus
    const postIds = await this.prisma.post.findMany({
      where: { campusId },
      select: { id: true },
    });
    const campusPostIds = postIds.map((p) => p.id);

    return await this.prisma.postApprovalRequest.count({
      where: {
        postId: { in: campusPostIds },
        status: ApprovalStatus.PENDING,
      },
    });
  }

  async save(request: PostApprovalRequest): Promise<PostApprovalRequest> {
    const prismaData = PrismaPostApprovalRequestMapper.toPrisma(request);
    const created = await this.prisma.postApprovalRequest.create({
      data: prismaData,
      include: {
        submittedBy: true,
        reviewedBy: true,
      },
    });
    return PrismaPostApprovalRequestMapper.toDomain(created);
  }

  async update(request: PostApprovalRequest): Promise<PostApprovalRequest> {
    const prismaData = PrismaPostApprovalRequestMapper.toPrismaUpdate(request);
    const updated = await this.prisma.postApprovalRequest.update({
      where: { id: request.id },
      data: prismaData,
      include: {
        submittedBy: true,
        reviewedBy: true,
      },
    });
    return PrismaPostApprovalRequestMapper.toDomain(updated);
  }
}
