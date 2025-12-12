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
    const postHistoryStatusProps = {
      postId: new UniqueEntityID(prismaPostHistoryStatus.postId),
      userId: new UniqueEntityID(prismaPostHistoryStatus.userId),
      status: prismaPostHistoryStatus.status as PostStatus,
      comment: prismaPostHistoryStatus.comment,
      createdAt: prismaPostHistoryStatus.createdAt,
      updatedAt: prismaPostHistoryStatus.updatedAt,
    };
    return PostHistoryStatus.create(
      postHistoryStatusProps,
      new UniqueEntityID(prismaPostHistoryStatus.id),
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(
    prismaPostHistoryStatus: PrismaPostHistoryStatus,
  ): PostHistoryStatus {
    const postHistoryStatusProps = {
      postId: new UniqueEntityID(prismaPostHistoryStatus.postId),
      userId: new UniqueEntityID(prismaPostHistoryStatus.userId),
      status: prismaPostHistoryStatus.status as PostStatus,
      comment: prismaPostHistoryStatus.comment,
      createdAt: prismaPostHistoryStatus.createdAt,
      updatedAt: prismaPostHistoryStatus.updatedAt,
    };
    return PostHistoryStatus.create(
      postHistoryStatusProps,
      new UniqueEntityID(prismaPostHistoryStatus.id),
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(
    postHistoryStatus: PostHistoryStatus,
  ): Prisma.PostHistoryStatusUncheckedCreateInput {
    return {
      id: postHistoryStatus.id.toString(),
      postId: postHistoryStatus.postId.toString(),
      userId: postHistoryStatus.userId.toString(),
      status: postHistoryStatus.status,
      comment: postHistoryStatus.comment ?? null,
      createdAt: postHistoryStatus.createdAt,
      updatedAt: postHistoryStatus.updatedAt ?? new Date(),
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
