import { PostReaction as PrismaPostReaction, Prisma } from "@prisma/client";
import { PostReaction } from "@/domain/content-management";

/**
 * Prisma PostReaction model type (no nested relations needed).
 */
type PrismaPostReactionWithRelations = PrismaPostReaction;

/**
 * Mapper for converting between Prisma PostReaction and domain PostReaction entity.
 * PostReaction is a simple entity with only create/delete operations (toggle pattern).
 */
export class PrismaPostReactionMapper {
  /**
   * Convert Prisma model to Domain entity.
   * @param prismaReaction - The Prisma PostReaction model.
   * @returns The domain PostReaction entity.
   */
  static toDomain(
    prismaReaction: PrismaPostReactionWithRelations,
  ): PostReaction {
    return PostReaction.create(
      {
        postId: prismaReaction.postId,
        userId: prismaReaction.userId,
        createdAt: prismaReaction.createdAt,
      },
      prismaReaction.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations).
   * For PostReaction, this is identical to toDomain as there are no nested relations.
   * @param prismaReaction - The Prisma PostReaction model.
   * @returns The domain PostReaction entity.
   */
  static toDomainSimple(prismaReaction: PrismaPostReaction): PostReaction {
    return PrismaPostReactionMapper.toDomain(prismaReaction);
  }

  /**
   * Convert Domain entity to Prisma create input.
   * @param reaction - The domain PostReaction entity.
   * @returns The Prisma create input.
   */
  static toPrisma(
    reaction: PostReaction,
  ): Prisma.PostReactionUncheckedCreateInput {
    return {
      id: reaction.id,
      postId: reaction.postId,
      userId: reaction.userId,
      createdAt: reaction.createdAt,
    };
  }

  /**
   * Convert array of Prisma models to Domain entities.
   * @param prismaReactions - Array of Prisma PostReaction models.
   * @returns Array of domain PostReaction entities.
   */
  static toDomainArray(
    prismaReactions: PrismaPostReactionWithRelations[],
  ): PostReaction[] {
    return prismaReactions.map((prismaReaction) =>
      PrismaPostReactionMapper.toDomain(prismaReaction),
    );
  }
}
