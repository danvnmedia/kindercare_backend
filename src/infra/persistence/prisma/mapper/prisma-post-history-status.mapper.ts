import {
  PostHistoryStatus as PrismaPostHistoryStatus,
  Prisma,
} from "@prisma/client";
import { PostHistoryStatus } from "@/domain/content-management/entities/post-history-status.entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { PostStatus } from "@/domain/content-management";

export class PrismaPostHistoryStatusMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(
    prismaPostHistoryStatus: PrismaPostHistoryStatus,
  ): PostHistoryStatus {
    return PostHistoryStatus.create(
      {
        postId: prismaPostHistoryStatus.postId,
        changedById: prismaPostHistoryStatus.changedById,
        previousStatus:
          prismaPostHistoryStatus.previousStatus as PostStatus | null,
        newStatus: prismaPostHistoryStatus.newStatus as PostStatus,
        reason: prismaPostHistoryStatus.reason,
        createdAt: prismaPostHistoryStatus.createdAt,
      },
      prismaPostHistoryStatus.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(
    prismaPostHistoryStatus: PrismaPostHistoryStatus,
  ): PostHistoryStatus {
    return PrismaPostHistoryStatusMapper.toDomain(prismaPostHistoryStatus);
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    postHistoryStatus: PostHistoryStatus,
  ): Prisma.PostHistoryStatusUncheckedCreateInput {
    return {
      id: postHistoryStatus.id,
      postId: postHistoryStatus.postId,
      changedById: postHistoryStatus.changedById,
      previousStatus: postHistoryStatus.previousStatus ?? null,
      newStatus: postHistoryStatus.newStatus,
      reason: postHistoryStatus.reason ?? null,
      createdAt: postHistoryStatus.createdAt,
    };
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(
    prismaPostHistoryStatuses: PrismaPostHistoryStatus[],
  ): PostHistoryStatus[] {
    return prismaPostHistoryStatuses.map((prismaPostHistoryStatus) =>
      PrismaPostHistoryStatusMapper.toDomain(prismaPostHistoryStatus),
    );
  }
}
