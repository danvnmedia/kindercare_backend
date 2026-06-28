import { PostCategory as PrismaPostCategory, Prisma } from "@prisma/client";
import { PostCategory } from "@/domain/content-management";

/**
 * Prisma PostCategory model type (no relations needed for this entity).
 */
type PrismaPostCategoryWithRelations = PrismaPostCategory;

/**
 * Mapper for converting between Prisma PostCategory and domain PostCategory entity.
 */
export class PrismaPostCategoryMapper {
  /**
   * Convert Prisma model to Domain entity.
   * @param prismaCategory - The Prisma PostCategory model.
   * @returns The domain PostCategory entity.
   */
  static toDomain(
    prismaCategory: PrismaPostCategoryWithRelations,
  ): PostCategory {
    return PostCategory.create(
      {
        campusId: prismaCategory.campusId,
        name: prismaCategory.name,
        color: prismaCategory.color,
        icon: prismaCategory.icon,
        order: prismaCategory.order,
        isArchived: prismaCategory.isArchived,
        createdAt: prismaCategory.createdAt,
        updatedAt: prismaCategory.updatedAt,
      },
      prismaCategory.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations).
   * For PostCategory, this is identical to toDomain as there are no nested relations.
   * @param prismaCategory - The Prisma PostCategory model.
   * @returns The domain PostCategory entity.
   */
  static toDomainSimple(prismaCategory: PrismaPostCategory): PostCategory {
    return PrismaPostCategoryMapper.toDomain(prismaCategory);
  }

  /**
   * Convert Domain entity to Prisma create input.
   * @param category - The domain PostCategory entity.
   * @returns The Prisma create input.
   */
  static toPrisma(
    category: PostCategory,
  ): Prisma.PostCategoryUncheckedCreateInput {
    return {
      id: category.id,
      campusId: category.campusId,
      name: category.name,
      color: category.color,
      icon: category.icon,
      order: category.order,
      isArchived: category.isArchived,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input.
   * @param category - The domain PostCategory entity.
   * @returns The Prisma update input.
   */
  static toPrismaUpdate(
    category: PostCategory,
  ): Prisma.PostCategoryUpdateInput {
    return {
      name: category.name,
      color: category.color,
      icon: category.icon,
      order: category.order,
      isArchived: category.isArchived,
      updatedAt: category.updatedAt,
    };
  }

  /**
   * Convert array of Prisma models to Domain entities.
   * @param prismaCategories - Array of Prisma PostCategory models.
   * @returns Array of domain PostCategory entities.
   */
  static toDomainArray(
    prismaCategories: PrismaPostCategoryWithRelations[],
  ): PostCategory[] {
    return prismaCategories.map((prismaCategory) =>
      PrismaPostCategoryMapper.toDomain(prismaCategory),
    );
  }
}
