import {
  Post as PrismaPost,
  PostAudience as PrismaPostAudience,
  Attachment as PrismaAttachment,
  User as PrismaUser,
  Prisma,
  Guardian as PrismaGuardian,
  Staff as PrismaStaff,
} from "@prisma/client";
import {
  Post,
  PostAudience,
  Attachment,
  PostStatus,
  AudienceType,
} from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity"; // Import the domain User interface
import { PrismaAttachmentMapper } from "./prisma-attachment.mapper";
import { PrismaUserMapper } from "./prisma-user.mapper";

type PrismaUserWithProfile = PrismaUser & {
  guardian?: PrismaGuardian | null;
  staff?: PrismaStaff | null;
};

export type PrismaPostWithRelations = PrismaPost & {
  author: PrismaUserWithProfile;
  audiences: PrismaPostAudience[];
  attachments: PrismaAttachment[];
};

export class PrismaPostMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaPost: PrismaPostWithRelations): Post {
    return Post.create(
      {
        authorId: prismaPost.authorId,
        author: PrismaUserMapper.toDomain(prismaPost.author),
        title: prismaPost.title,
        content: prismaPost.content,
        status: prismaPost.status as PostStatus,
        publishAt: prismaPost.publishAt,
        audiences: [],
        attachments: PrismaAttachmentMapper.toDomainArray(
          prismaPost.attachments,
        ),
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
        authorId: prismaPost.authorId,
        author: PrismaUserMapper.toDomainSimple(prismaPost.author),
        title: prismaPost.title,
        content: prismaPost.content,
        status: prismaPost.status as PostStatus,
        publishAt: prismaPost.publishAt,
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
      authorId: post.authorId,
      title: post.title,
      content: post.content ?? null,
      status: post.status,
      publishAt: post.publishAt ?? null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt ?? new Date(),
    };
  }

  /**
   * Convert Domain entity to Prisma update input
   */
  static toPrismaUpdate(post: Post): Prisma.PostUpdateInput {
    return {
      title: post.title,
      content: post.content ?? null,
      status: post.status,
      publishAt: post.publishAt ?? null,
      updatedAt: post.updatedAt ?? new Date(),
    };
  }

  /**
   * Convert array of Prisma models to Domain entities
   */
  static toDomainArray(prismaPosts: PrismaPostWithRelations[]): Post[] {
    return prismaPosts.map((prismaPost) =>
      PrismaPostMapper.toDomain(prismaPost),
    );
  }

  static toPrismaPostAudience(postAudience: PostAudience): PrismaPostAudience {
    const prismaPostAudience: PrismaPostAudience = {
      id: postAudience.id.toString(),
      type: postAudience.audienceType,
      postId: postAudience.postId.toString(),
      classId: null,
      studentId: null,
      gradeLevelId: null,
    };

    switch (postAudience.audienceType) {
      case AudienceType.CLASS:
        prismaPostAudience.classId = postAudience.audienceId.toString();
        break;
      case AudienceType.STUDENT:
        prismaPostAudience.studentId = postAudience.audienceId.toString();
        break;
      case AudienceType.GRADE:
        prismaPostAudience.gradeLevelId = postAudience.audienceId.toString();
        break;
    }
    return prismaPostAudience;
  }

  /**
   * Convert PostAudience to Prisma create input for nested relations.
   * Note: postId is omitted because Prisma handles it automatically in nested creates.
   */
  static toPrismaPostAudienceCreate(
    postAudience: PostAudience,
  ): Omit<PrismaPostAudience, "postId"> {
    const result: Omit<PrismaPostAudience, "postId"> = {
      id: postAudience.id.toString(),
      type: postAudience.audienceType,
      classId: null,
      studentId: null,
      gradeLevelId: null,
    };

    switch (postAudience.audienceType) {
      case AudienceType.CLASS:
        result.classId = postAudience.audienceId.toString();
        break;
      case AudienceType.STUDENT:
        result.studentId = postAudience.audienceId.toString();
        break;
      case AudienceType.GRADE:
        result.gradeLevelId = postAudience.audienceId.toString();
        break;
    }
    return result;
  }
}
