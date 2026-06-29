import { Injectable } from "@nestjs/common";
import {
  PostRepository,
  CreatePostOptions,
  UpdatePostOptions,
} from "@/application/content-management/ports/post.repository";
import { Post } from "@/domain/content-management";
import { PrismaService } from "../prisma.service";
import {
  PrismaPostMapper,
  PrismaPostWithRelations,
} from "../mapper/prisma-post.mapper";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

@Injectable()
export class PrismaPostRepository implements PostRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async create(post: Post, options?: CreatePostOptions): Promise<Post> {
    const prismaPost = PrismaPostMapper.toPrisma(post);
    const createdPost = await this.prisma.post.create({
      data: {
        ...prismaPost,
        audiences: {
          create: post.audiences.map((audience) =>
            PrismaPostMapper.toPrismaPostAudienceCreate(audience),
          ),
        },
        // Link categories if provided
        ...(options?.categoryIds &&
          options.categoryIds.length > 0 && {
            categories: {
              create: options.categoryIds.map((categoryId) => ({
                categoryId,
              })),
            },
          }),
      },
      include: {
        author: true,
        audiences: {
          include: {
            class: { select: { id: true, name: true } },
            student: { select: { id: true, fullName: true } },
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        attachments: {
          include: {
            file: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
    return PrismaPostMapper.toDomain(createdPost);
  }

  async update(
    id: string,
    data: Post,
    options?: UpdatePostOptions,
  ): Promise<Post> {
    const prismaPost = PrismaPostMapper.toPrisma(data);
    const updatedPost = await this.prisma.post.update({
      where: { id },
      data: {
        ...prismaPost,
        audiences: {
          deleteMany: {},
          create: data.audiences.map((audience) =>
            PrismaPostMapper.toPrismaPostAudienceCreate(audience),
          ),
        },
        // Update categories if provided (replace all)
        ...(options?.categoryIds !== undefined && {
          categories: {
            deleteMany: {},
            ...(options.categoryIds.length > 0 && {
              create: options.categoryIds.map((categoryId) => ({
                categoryId,
              })),
            }),
          },
        }),
      },
      include: {
        author: true,
        audiences: {
          include: {
            class: { select: { id: true, name: true } },
            student: { select: { id: true, fullName: true } },
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        attachments: {
          include: {
            file: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    });
    return PrismaPostMapper.toDomain(updatedPost);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        isPinned: false,
        pinnedUntil: null,
        pinnedById: null,
      },
    });
  }

  async findById(id: string): Promise<Post | null> {
    const post = (await this.prisma.post.findFirst({
      where: { id, isDeleted: false },
      include: {
        author: {
          include: {
            guardians: true,
            staffs: true,
          },
        },
        audiences: {
          include: {
            class: { select: { id: true, name: true } },
            student: { select: { id: true, fullName: true } },
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        attachments: {
          include: {
            file: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    })) as PrismaPostWithRelations | null;
    return post ? PrismaPostMapper.toDomain(post) : null;
  }

  async findMany(
    query: StandardRequestDto,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Post>> {
    const categoryIdFilter = query.filterInfo?.filters?.categoryId;
    const searchTerm = this.getSearchTerm(query);

    query.allowedFilterFields = [
      "title",
      "content",
      "contentText",
      "type",
      "status",
      "authorId",
      "isPinned",
      "campusId",
    ];
    query.allowedSortFields = [
      "createdAt",
      "updatedAt",
      "title",
      "publishAt",
      "isPinned",
    ];

    const where = {
      isDeleted: false,
      ...(categoryIdFilter
        ? {
            categories: {
              some: {
                categoryId: this.buildCategoryIdWhere(categoryIdFilter),
              },
            },
          }
        : {}),
      ...(searchTerm
        ? {
            OR: [
              { title: { contains: searchTerm, mode: "insensitive" } },
              { contentText: { contains: searchTerm, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    return await this.queryService.executeQuery<Post>(
      this.prisma,
      "post",
      query,
      {
        where,
        include: {
          author: {
            include: {
              guardians: true,
              staffs: true,
            },
          },
          audiences: {
            include: {
              class: { select: { id: true, name: true } },
              student: { select: { id: true, fullName: true } },
              gradeLevel: { select: { id: true, name: true } },
            },
          },
          attachments: {
            include: {
              file: true,
            },
          },
          categories: {
            include: {
              category: true,
            },
          },
        },
        scope,
      },
      PrismaPostMapper,
    );
  }

  private getSearchTerm(query: StandardRequestDto): string | null {
    const rawQuery = query as StandardRequestDto & {
      search?: unknown;
      q?: unknown;
    };
    const value = rawQuery.search ?? rawQuery.q;

    if (typeof value !== "string") return null;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private buildCategoryIdWhere(filter: unknown): string | { in: string[] } {
    if (typeof filter === "string") return filter;

    if (typeof filter === "object" && filter !== null && "eq" in filter) {
      const value = (filter as { eq?: unknown }).eq;
      if (typeof value === "string") return value;
    }

    if (typeof filter === "object" && filter !== null && "in" in filter) {
      const value = (filter as { in?: unknown }).in;
      if (Array.isArray(value)) {
        return {
          in: value.filter((item): item is string => typeof item === "string"),
        };
      }
    }

    return "";
  }

  async countPinnedByCampus(campusId: string): Promise<number> {
    const now = new Date();
    return await this.prisma.post.count({
      where: {
        campusId,
        isPinned: true,
        isDeleted: false,
        OR: [{ pinnedUntil: null }, { pinnedUntil: { gt: now } }],
      },
    });
  }

  async findPinnedByCampus(campusId: string): Promise<Post[]> {
    const now = new Date();
    const posts = (await this.prisma.post.findMany({
      where: {
        campusId,
        isPinned: true,
        isDeleted: false,
        OR: [{ pinnedUntil: null }, { pinnedUntil: { gt: now } }],
      },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          include: {
            guardians: true,
            staffs: true,
          },
        },
        audiences: {
          include: {
            class: { select: { id: true, name: true } },
            student: { select: { id: true, fullName: true } },
            gradeLevel: { select: { id: true, name: true } },
          },
        },
        attachments: {
          include: {
            file: true,
          },
        },
        categories: {
          include: {
            category: true,
          },
        },
      },
    })) as PrismaPostWithRelations[];

    return posts.map((post) => PrismaPostMapper.toDomain(post));
  }
}
