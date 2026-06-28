import { CampusSetting as PrismaCampusSetting, Prisma } from "@prisma/client";
import { CampusSetting } from "@/domain/content-management";

/**
 * Prisma CampusSetting model type (no relations needed for this entity).
 */
type PrismaCampusSettingWithRelations = PrismaCampusSetting;

/**
 * Mapper for converting between Prisma CampusSetting and domain CampusSetting entity.
 * CampusSetting is a simple entity with no nested relations.
 */
export class PrismaCampusSettingMapper {
  /**
   * Convert Prisma model to Domain entity.
   * @param prismaSetting - The Prisma CampusSetting model.
   * @returns The domain CampusSetting entity.
   */
  static toDomain(
    prismaSetting: PrismaCampusSettingWithRelations,
  ): CampusSetting {
    return CampusSetting.create(
      {
        campusId: prismaSetting.campusId,
        requireTeacherApproval: prismaSetting.requireTeacherApproval,
        maxPinnedPosts: prismaSetting.maxPinnedPosts,
        allowParentComments: prismaSetting.allowParentComments,
        allowReactions: prismaSetting.allowReactions,
        createdAt: prismaSetting.createdAt,
        updatedAt: prismaSetting.updatedAt,
      },
      prismaSetting.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations).
   * For CampusSetting, this is identical to toDomain as there are no nested relations.
   * @param prismaSetting - The Prisma CampusSetting model.
   * @returns The domain CampusSetting entity.
   */
  static toDomainSimple(prismaSetting: PrismaCampusSetting): CampusSetting {
    return PrismaCampusSettingMapper.toDomain(prismaSetting);
  }

  /**
   * Convert Domain entity to Prisma create input.
   * @param setting - The domain CampusSetting entity.
   * @returns The Prisma create input.
   */
  static toPrisma(
    setting: CampusSetting,
  ): Prisma.CampusSettingUncheckedCreateInput {
    return {
      id: setting.id,
      campusId: setting.campusId,
      requireTeacherApproval: setting.requireTeacherApproval,
      maxPinnedPosts: setting.maxPinnedPosts,
      allowParentComments: setting.allowParentComments,
      allowReactions: setting.allowReactions,
      createdAt: setting.createdAt,
      updatedAt: setting.updatedAt,
    };
  }

  /**
   * Convert Domain entity to Prisma update input.
   * @param setting - The domain CampusSetting entity.
   * @returns The Prisma update input.
   */
  static toPrismaUpdate(
    setting: CampusSetting,
  ): Prisma.CampusSettingUpdateInput {
    return {
      requireTeacherApproval: setting.requireTeacherApproval,
      maxPinnedPosts: setting.maxPinnedPosts,
      allowParentComments: setting.allowParentComments,
      allowReactions: setting.allowReactions,
      updatedAt: setting.updatedAt,
    };
  }

  /**
   * Convert array of Prisma models to Domain entities.
   * @param prismaSettings - Array of Prisma CampusSetting models.
   * @returns Array of domain CampusSetting entities.
   */
  static toDomainArray(
    prismaSettings: PrismaCampusSettingWithRelations[],
  ): CampusSetting[] {
    return prismaSettings.map((prismaSetting) =>
      PrismaCampusSettingMapper.toDomain(prismaSetting),
    );
  }
}
