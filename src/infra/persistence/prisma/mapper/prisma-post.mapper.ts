import {
  Post as PrismaPost,
  PostAudience as PrismaPostAudience,
  Attachment as PrismaAttachment,
  User as PrismaUser,
  Prisma,
} from "@prisma/client";
import {
  Post,
  PostAudience,
  Attachment,
  PostStatus,
  PostType,
  AudienceType,
} from "@/domain/content-management";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

export type PrismaPostWithRelations = PrismaPost & {
  author: PrismaUser;
  audiences: PrismaPostAudience[];
  attachments: PrismaAttachment[];
};

export class PrismaPostMapper {
  /**
   * Convert Prisma model to Domain entity (full)
   */
  static toDomain(prismaPost: PrismaPostWithRelations): Post {
    const postProps = {
      authorId: new UniqueEntityID(prismaPost.authorId),
      author: {
        id: prismaPost.author.id,
        clerkUid: prismaPost.author.clerkUid,
        isActive: prismaPost.author.isActive,
        createdAt: prismaPost.author.createdAt,
        updatedAt: prismaPost.author.updatedAt,
      },
      type: prismaPost.type as PostType,
      title: prismaPost.title,
      content: prismaPost.content,
      status: prismaPost.status as PostStatus,
      publishAt: prismaPost.publishAt,
      audiences: prismaPost.audiences.map((audience) => {
        let audienceId: UniqueEntityID;
        switch (audience.type as AudienceType) {
          case AudienceType.CLASS:
            audienceId = new UniqueEntityID(audience.classId as string);
            break;
          case AudienceType.STUDENT:
            audienceId = new UniqueEntityID(audience.studentId as string);
            break;
          case AudienceType.GRADE:
            audienceId = new UniqueEntityID(audience.gradeLevelId as string);
            break;
          default:
            throw new Error(`Unknown AudienceType: ${audience.type}`);
        }
        return PostAudience.create(
          {
            postId: new UniqueEntityID(audience.postId),
            audienceType: audience.type as AudienceType,
            audienceId: audienceId,
          },
          new UniqueEntityID(audience.id),
        );
      }),
      attachments: prismaPost.attachments.map((attachment) =>
        Attachment.create(
          {
            postId: new UniqueEntityID(attachment.postId),
            fileId: new UniqueEntityID(attachment.fileId),
            comment: attachment.comment,
            order: attachment.order,
            createdAt: attachment.createdAt,
            updatedAt: attachment.updatedAt,
          },
          new UniqueEntityID(attachment.id),
        ),
      ),
      createdAt: prismaPost.createdAt,
      updatedAt: prismaPost.updatedAt,
    };
    return Post.create(postProps, new UniqueEntityID(prismaPost.id));
  }

  /**
   * Convert Prisma model to Domain entity (without nested relations)
   * Use to prevent circular references
   */
  static toDomainSimple(prismaPost: PrismaPost): Post {
    const postProps = {
      authorId: new UniqueEntityID(prismaPost.authorId),
      author: {
        // Provide minimal user object instead of undefined
        id: prismaPost.authorId,
        clerkUid: "", // Minimal required data to satisfy type
        isActive: true, // Minimal required data to satisfy type
        createdAt: prismaPost.createdAt, // Minimal required data to satisfy type
        updatedAt: prismaPost.updatedAt, // Minimal required data to satisfy type
      },
      type: prismaPost.type as PostType,
      title: prismaPost.title,
      content: prismaPost.content,
      status: prismaPost.status as PostStatus,
      publishAt: prismaPost.publishAt,
      createdAt: prismaPost.createdAt,
      updatedAt: prismaPost.updatedAt,
    };
    return Post.create(postProps, new UniqueEntityID(prismaPost.id));
  }

  /**
   * Convert Domain entity to Prisma create input
   */
  static toPrisma(post: Post): Prisma.PostUncheckedCreateInput {
    return {
      id: post.id.toString(),
      authorId: post.authorId.toString(),
      type: post.type,
      title: post.title,
      content: post.content ?? null,
      status: post.status,
      publishAt: post.publishAt ?? null,
      createdAt: post.createdAt,
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
