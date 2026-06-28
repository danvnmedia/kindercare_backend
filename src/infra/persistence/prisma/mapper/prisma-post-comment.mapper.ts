import { PostComment as PrismaPostComment, Prisma } from "@prisma/client";
import { PostComment } from "@/domain/content-management";

/**
 * Prisma PostComment model with optional parent relation.
 * Used for loading comments with their parent for threading context.
 */
type PrismaPostCommentWithRelations = PrismaPostComment & {
  parentComment?: PrismaPostComment | null;
};

/**
 * Mapper for converting between Prisma PostComment and domain PostComment entity.
 * Handles self-referential parent/child relationships for threaded comments.
 */
export class PrismaPostCommentMapper {
  /**
   * Convert Prisma model to Domain entity.
   * @param prismaComment - The Prisma PostComment model.
   * @returns The domain PostComment entity.
   */
  static toDomain(prismaComment: PrismaPostCommentWithRelations): PostComment {
    return PostComment.create(
      {
        postId: prismaComment.postId,
        userId: prismaComment.userId,
        parentCommentId: prismaComment.parentCommentId,
        depth: prismaComment.depth,
        content: prismaComment.content,
        isDeleted: prismaComment.isDeleted,
        deletedAt: prismaComment.deletedAt,
        deletedById: prismaComment.deletedById,
        createdAt: prismaComment.createdAt,
        updatedAt: prismaComment.updatedAt,
      },
      prismaComment.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations).
   * For PostComment, this is identical to toDomain as nested parent is optional.
   * @param prismaComment - The Prisma PostComment model.
   * @returns The domain PostComment entity.
   */
  static toDomainSimple(prismaComment: PrismaPostComment): PostComment {
    return PrismaPostCommentMapper.toDomain(prismaComment);
  }

  /**
   * Convert Domain entity to Prisma create input.
   * @param comment - The domain PostComment entity.
   * @returns The Prisma create input.
   */
  static toPrisma(
    comment: PostComment,
  ): Prisma.PostCommentUncheckedCreateInput {
    return {
      id: comment.id,
      postId: comment.postId,
      userId: comment.userId,
      parentCommentId: comment.parentCommentId,
      depth: comment.depth,
      content: comment.content,
      isDeleted: comment.isDeleted,
      deletedAt: comment.deletedAt,
      deletedById: comment.deletedById,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input.
   * Handles soft delete fields and content updates.
   * @param comment - The domain PostComment entity.
   * @returns The Prisma update input.
   */
  static toPrismaUpdate(comment: PostComment): Prisma.PostCommentUpdateInput {
    const updateData: Prisma.PostCommentUpdateInput = {
      content: comment.content,
      isDeleted: comment.isDeleted,
      deletedAt: comment.deletedAt,
      updatedAt: comment.updatedAt,
    };

    // Handle deletedBy relation
    if (comment.deletedById) {
      updateData.deletedBy = { connect: { id: comment.deletedById } };
    } else {
      updateData.deletedBy = { disconnect: true };
    }

    return updateData;
  }

  /**
   * Convert array of Prisma models to Domain entities.
   * @param prismaComments - Array of Prisma PostComment models.
   * @returns Array of domain PostComment entities.
   */
  static toDomainArray(
    prismaComments: PrismaPostCommentWithRelations[],
  ): PostComment[] {
    return prismaComments.map((prismaComment) =>
      PrismaPostCommentMapper.toDomain(prismaComment),
    );
  }
}
