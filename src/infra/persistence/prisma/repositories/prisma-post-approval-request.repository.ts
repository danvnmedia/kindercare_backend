import { PostApprovalRequestRepository } from "@/application/content-management/ports/post-approval-request.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import {
  PostApprovalRequest,
  ApprovalStatus,
  PostStatus,
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
      include: PrismaPostApprovalRequestMapper.include,
    });
    return prismaRequest
      ? PrismaPostApprovalRequestMapper.toDomain(prismaRequest)
      : null;
  }

  async findByPostId(postId: string): Promise<PostApprovalRequest[]> {
    const prismaRequests = await this.prisma.postApprovalRequest.findMany({
      where: { postId },
      include: PrismaPostApprovalRequestMapper.include,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    return PrismaPostApprovalRequestMapper.toDomainArray(prismaRequests);
  }

  async findLatestByPostId(
    postId: string,
  ): Promise<PostApprovalRequest | null> {
    const prismaRequest = await this.prisma.postApprovalRequest.findFirst({
      where: { postId },
      include: PrismaPostApprovalRequestMapper.include,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
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

    const currentPendingRequestIds =
      await this.findCurrentPendingRequestIds(campusId);

    return this.queryService.executeQuery<PostApprovalRequest>(
      this.prisma,
      "postApprovalRequest",
      params,
      {
        where: {
          id: { in: currentPendingRequestIds },
          status: ApprovalStatus.PENDING,
          post: {
            campusId,
            isDeleted: false,
            status: PostStatus.PENDING_REVIEW,
          },
        },
        include: PrismaPostApprovalRequestMapper.include,
        orderBy: [
          { submittedAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
      },
      PrismaPostApprovalRequestMapper,
    );
  }

  async findByCampusAndStatus(
    campusId: string,
    status: ApprovalStatus,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostApprovalRequest>> {
    if (status === ApprovalStatus.PENDING) {
      return this.findPendingByCampus(campusId, params);
    }

    params.allowedFilterFields = ["submittedById", "reviewedById"];
    params.allowedSortFields = ["submittedAt", "reviewedAt", "createdAt"];

    return this.queryService.executeQuery<PostApprovalRequest>(
      this.prisma,
      "postApprovalRequest",
      params,
      {
        where: {
          post: { campusId },
          status,
        },
        include: PrismaPostApprovalRequestMapper.include,
        orderBy: [
          { submittedAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
      },
      PrismaPostApprovalRequestMapper,
    );
  }

  async countPendingByCampus(campusId: string): Promise<number> {
    const currentPendingRequestIds =
      await this.findCurrentPendingRequestIds(campusId);

    return this.prisma.postApprovalRequest.count({
      where: {
        id: { in: currentPendingRequestIds },
        status: ApprovalStatus.PENDING,
        post: {
          campusId,
          isDeleted: false,
          status: PostStatus.PENDING_REVIEW,
        },
      },
    });
  }

  async save(request: PostApprovalRequest): Promise<PostApprovalRequest> {
    const prismaData = PrismaPostApprovalRequestMapper.toPrisma(request);
    const created = await this.prisma.postApprovalRequest.create({
      data: prismaData,
      include: PrismaPostApprovalRequestMapper.include,
    });
    return PrismaPostApprovalRequestMapper.toDomain(created);
  }

  async update(request: PostApprovalRequest): Promise<PostApprovalRequest> {
    const prismaData = PrismaPostApprovalRequestMapper.toPrismaUpdate(request);
    const updated = await this.prisma.postApprovalRequest.update({
      where: { id: request.id },
      data: prismaData,
      include: PrismaPostApprovalRequestMapper.include,
    });
    return PrismaPostApprovalRequestMapper.toDomain(updated);
  }

  private async findCurrentPendingRequestIds(
    campusId: string,
  ): Promise<string[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        campusId,
        isDeleted: false,
        status: PostStatus.PENDING_REVIEW,
      },
      select: {
        approvalRequests: {
          orderBy: [
            { submittedAt: "desc" },
            { createdAt: "desc" },
            { id: "desc" },
          ],
          take: 1,
          select: { id: true, status: true },
        },
      },
    });

    return posts.flatMap(({ approvalRequests }) => {
      const latestRequest = approvalRequests[0];
      return latestRequest?.status === ApprovalStatus.PENDING
        ? [latestRequest.id]
        : [];
    });
  }
}
