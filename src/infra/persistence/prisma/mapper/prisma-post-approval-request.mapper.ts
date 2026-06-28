import {
  PostApprovalRequest as PrismaPostApprovalRequest,
  User as PrismaUser,
  Prisma,
} from "@prisma/client";
import {
  PostApprovalRequest,
  ApprovalStatus,
} from "@/domain/content-management";

/**
 * Prisma PostApprovalRequest model with optional user relations.
 */
type PrismaPostApprovalRequestWithRelations = PrismaPostApprovalRequest & {
  submittedBy?: PrismaUser | null;
  reviewedBy?: PrismaUser | null;
};

/**
 * Mapper for converting between Prisma PostApprovalRequest and domain PostApprovalRequest entity.
 * Handles JSON content snapshots and approval workflow state.
 */
export class PrismaPostApprovalRequestMapper {
  /**
   * Convert Prisma model to Domain entity.
   * @param prismaRequest - The Prisma PostApprovalRequest model.
   * @returns The domain PostApprovalRequest entity.
   */
  static toDomain(
    prismaRequest: PrismaPostApprovalRequestWithRelations,
  ): PostApprovalRequest {
    return PostApprovalRequest.create(
      {
        postId: prismaRequest.postId,
        submittedById: prismaRequest.submittedById,
        submittedAt: prismaRequest.submittedAt,
        status: prismaRequest.status as ApprovalStatus,
        reviewedById: prismaRequest.reviewedById,
        reviewedAt: prismaRequest.reviewedAt,
        reviewNote: prismaRequest.reviewNote,
        titleSnapshot: prismaRequest.titleSnapshot,
        contentSnapshot: prismaRequest.contentSnapshot as Record<
          string,
          unknown
        > | null,
        createdAt: prismaRequest.createdAt,
      },
      prismaRequest.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations).
   * For PostApprovalRequest, this is identical to toDomain as user relations are optional.
   * @param prismaRequest - The Prisma PostApprovalRequest model.
   * @returns The domain PostApprovalRequest entity.
   */
  static toDomainSimple(
    prismaRequest: PrismaPostApprovalRequest,
  ): PostApprovalRequest {
    return PrismaPostApprovalRequestMapper.toDomain(prismaRequest);
  }

  /**
   * Convert Domain entity to Prisma create input.
   * @param request - The domain PostApprovalRequest entity.
   * @returns The Prisma create input.
   */
  static toPrisma(
    request: PostApprovalRequest,
  ): Prisma.PostApprovalRequestUncheckedCreateInput {
    return {
      id: request.id,
      postId: request.postId,
      submittedById: request.submittedById,
      submittedAt: request.submittedAt,
      status: request.status,
      reviewedById: request.reviewedById,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
      titleSnapshot: request.titleSnapshot,
      contentSnapshot:
        request.contentSnapshot === null
          ? Prisma.JsonNull
          : (request.contentSnapshot as Prisma.InputJsonValue),
      createdAt: request.createdAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input.
   * Used for updating review status and reviewer information.
   * @param request - The domain PostApprovalRequest entity.
   * @returns The Prisma update input.
   */
  static toPrismaUpdate(
    request: PostApprovalRequest,
  ): Prisma.PostApprovalRequestUpdateInput {
    const updateData: Prisma.PostApprovalRequestUpdateInput = {
      status: request.status,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote,
    };

    // Handle reviewedBy relation
    if (request.reviewedById) {
      updateData.reviewedBy = { connect: { id: request.reviewedById } };
    } else {
      updateData.reviewedBy = { disconnect: true };
    }

    return updateData;
  }

  /**
   * Convert array of Prisma models to Domain entities.
   * @param prismaRequests - Array of Prisma PostApprovalRequest models.
   * @returns Array of domain PostApprovalRequest entities.
   */
  static toDomainArray(
    prismaRequests: PrismaPostApprovalRequestWithRelations[],
  ): PostApprovalRequest[] {
    return prismaRequests.map((prismaRequest) =>
      PrismaPostApprovalRequestMapper.toDomain(prismaRequest),
    );
  }
}
