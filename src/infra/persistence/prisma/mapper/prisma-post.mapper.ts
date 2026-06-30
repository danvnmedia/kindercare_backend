import {
  Post as PrismaPost,
  PostAudience as PrismaPostAudience,
  PostCategoryLink as PrismaPostCategoryLink,
  PostCategory as PrismaPostCategory,
  User as PrismaUser,
  Prisma,
  Guardian as PrismaGuardian,
  Staff as PrismaStaff,
} from "@prisma/client";
import {
  Post,
  PostAudience,
  PostStatus,
  AudienceType,
} from "@/domain/content-management";
import {
  PrismaAttachmentMapper,
  PrismaAttachmentWithFile,
} from "./prisma-attachment.mapper";
import { PrismaUserMapper } from "./prisma-user.mapper";
import { PostContent } from "@/domain/content-management/entities/post.entity";

type PrismaUserWithProfile = PrismaUser & {
  guardian?: PrismaGuardian | null;
  staff?: PrismaStaff | null;
};

type PrismaPostCategoryLinkWithCategory = PrismaPostCategoryLink & {
  category: PrismaPostCategory;
};

export type PrismaPostWithRelations = PrismaPost & {
  author: PrismaUserWithProfile;
  audiences: PrismaPostAudience[];
  attachments: PrismaAttachmentWithFile[];
  categories?: PrismaPostCategoryLinkWithCategory[];
};

export class PrismaPostMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaPost: PrismaPostWithRelations): Post {
    return Post.create(
      {
        campusId: prismaPost.campusId,
        authorId: prismaPost.authorId,
        author: PrismaUserMapper.toDomain(prismaPost.author),
        title: prismaPost.title,
        content: prismaPost.content as PostContent,
        contentText: prismaPost.contentText,
        contentVersion: prismaPost.contentVersion,
        status: prismaPost.status as PostStatus,
        publishAt: prismaPost.publishAt,
        isPinned: prismaPost.isPinned,
        pinnedUntil: prismaPost.pinnedUntil,
        pinnedById: prismaPost.pinnedById,
        requiresApproval: prismaPost.requiresApproval,
        isDeleted: prismaPost.isDeleted,
        deletedAt: prismaPost.deletedAt,
        audiences: [],
        attachments: PrismaAttachmentMapper.toDomainArray(
          prismaPost.attachments,
        ),
        categories: prismaPost.categories?.map((link) => ({
          id: link.category.id,
          name: link.category.name,
          color: link.category.color,
          icon: link.category.icon,
        })),
        createdAt: prismaPost.createdAt,
        updatedAt: prismaPost.updatedAt,
      },
      prismaPost.id,
    );
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaPost: PrismaPostWithRelations): Post {
    return Post.create(
      {
        campusId: prismaPost.campusId,
        authorId: prismaPost.authorId,
        author: PrismaUserMapper.toDomainSimple(prismaPost.author),
        title: prismaPost.title,
        content: prismaPost.content as PostContent,
        contentText: prismaPost.contentText,
        contentVersion: prismaPost.contentVersion,
        status: prismaPost.status as PostStatus,
        publishAt: prismaPost.publishAt,
        isPinned: prismaPost.isPinned,
        pinnedUntil: prismaPost.pinnedUntil,
        pinnedById: prismaPost.pinnedById,
        requiresApproval: prismaPost.requiresApproval,
        isDeleted: prismaPost.isDeleted,
        deletedAt: prismaPost.deletedAt,
        createdAt: prismaPost.createdAt,
        updatedAt: prismaPost.updatedAt,
      },
      prismaPost.id,
    );
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(post: Post): Prisma.PostUncheckedCreateInput {
    return {
      id: post.id,
      campusId: post.campusId,
      authorId: post.authorId,
      title: post.title,
      content:
        post.content === null
          ? Prisma.JsonNull
          : (post.content as Prisma.InputJsonValue),
      contentText: post.contentText,
      contentVersion: post.contentVersion,
      status: post.status,
      publishAt: post.publishAt ?? null,
      isPinned: post.isPinned,
      pinnedUntil: post.pinnedUntil ?? null,
      pinnedById: post.pinnedById ?? null,
      requiresApproval: post.requiresApproval,
      isDeleted: post.isDeleted,
      deletedAt: post.deletedAt ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt ?? new Date(),
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(post: Post): Prisma.PostUpdateInput {
    const updateData: Prisma.PostUpdateInput = {
      title: post.title,
      content:
        post.content === null
          ? Prisma.JsonNull
          : (post.content as Prisma.InputJsonValue),
      contentText: post.contentText,
      contentVersion: post.contentVersion,
      status: post.status,
      publishAt: post.publishAt ?? null,
      isPinned: post.isPinned,
      pinnedUntil: post.pinnedUntil ?? null,
      requiresApproval: post.requiresApproval,
      isDeleted: post.isDeleted,
      deletedAt: post.deletedAt ?? null,
      updatedAt: post.updatedAt ?? new Date(),
    };

    // Handle pinnedBy relation
    if (post.pinnedById) {
      updateData.pinnedBy = { connect: { id: post.pinnedById } };
    } else {
      updateData.pinnedBy = { disconnect: true };
    }

    return updateData;
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaPosts: PrismaPostWithRelations[]): Post[] {
    return prismaPosts.map((prismaPost) =>
      PrismaPostMapper.toDomain(prismaPost),
    );
  }

  static toPrismaPostAudience(postAudience: PostAudience) {
    const prismaPostAudience: {
      id: string;
      type: AudienceType;
      postId: string;
      campusId: string;
      classId: string | null;
    } = {
      id: postAudience.id.toString(),
      type: postAudience.audienceType,
      postId: postAudience.postId.toString(),
      campusId: postAudience.campusId,
      classId: null,
    };

    switch (postAudience.audienceType) {
      case AudienceType.CLASS:
        prismaPostAudience.classId = postAudience.audienceId.toString();
        break;
    }
    return prismaPostAudience;
  }

  /**
   * Convert PostAudience to Prisma create input for nested relations.
   * Note: postId is omitted because Prisma handles it automatically in nested creates.
   */
  static toPrismaPostAudienceCreate(postAudience: PostAudience) {
    const result: {
      id: string;
      type: AudienceType;
      campusId: string;
      classId: string | null;
    } = {
      id: postAudience.id.toString(),
      type: postAudience.audienceType,
      campusId: postAudience.campusId,
      classId: null,
    };

    switch (postAudience.audienceType) {
      case AudienceType.CLASS:
        result.classId = postAudience.audienceId.toString();
        break;
    }
    return result;
  }
}
