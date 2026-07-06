import { Injectable } from "@nestjs/common";
import {
  PostRepository,
  CreatePostOptions,
  UpdatePostOptions,
  PostAudienceFacets,
} from "@/application/content-management/ports/post.repository";
import { Prisma } from "@prisma/client";
import { Post, AudienceType, PostStatus } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
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

  async findVisibleById(
    id: string,
    campusId: string,
    viewer: User,
  ): Promise<Post | null> {
    const post = (await this.prisma.post.findFirst({
      where: {
        id,
        campusId,
        isDeleted: false,
        ...this.buildViewerVisibilityWhere(viewer),
      },
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
    viewer?: User,
  ): Promise<PaginatedResult<Post>> {
    const categoryIdFilter = query.filterInfo?.filters?.categoryId;
    const audienceTypeFilter = this.getStringFilterValue(
      query.filterInfo?.filters?.audienceType,
    );
    const classIdFilter = this.getStringFilterValue(
      query.filterInfo?.filters?.classId,
    );
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
      "audienceType",
      "classId",
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
      ...this.buildViewerVisibilityWhere(viewer),
      ...(categoryIdFilter
        ? {
            categories: {
              some: {
                categoryId: this.buildCategoryIdWhere(categoryIdFilter),
              },
            },
          }
        : {}),
      ...(audienceTypeFilter === AudienceType.ALL
        ? { audiences: { some: { type: AudienceType.ALL } } }
        : {}),
      ...(audienceTypeFilter === AudienceType.CLASS && !classIdFilter
        ? { audiences: { some: { type: AudienceType.CLASS } } }
        : {}),
      ...(classIdFilter
        ? {
            audiences: {
              some: { type: AudienceType.CLASS, classId: classIdFilter },
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

  async findAudienceFacets(
    campusId: string,
    query: StandardRequestDto,
    viewer?: User,
  ): Promise<PostAudienceFacets> {
    const categoryIdFilter = query.filterInfo?.filters?.categoryId;
    const statusFilter = query.filterInfo?.filters?.status;
    const searchTerm = this.getSearchTerm(query);
    const statusWhere = this.buildPostStatusWhere(statusFilter);
    const baseWhere: Prisma.PostWhereInput = {
      campusId,
      isDeleted: false,
      ...this.buildViewerVisibilityWhere(viewer),
      ...(statusWhere ? { status: statusWhere } : {}),
      ...(categoryIdFilter
        ? {
            categories: {
              some: { categoryId: this.buildCategoryIdWhere(categoryIdFilter) },
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

    const [allCount, classCount, classGroups] = await Promise.all([
      this.prisma.post.count({
        where: {
          ...baseWhere,
          audiences: { some: { type: AudienceType.ALL } },
        },
      }),
      this.prisma.post.count({
        where: {
          ...baseWhere,
          audiences: { some: { type: AudienceType.CLASS } },
        },
      }),
      this.prisma.postAudience.groupBy({
        by: ["classId"],
        where: {
          type: AudienceType.CLASS,
          classId: { not: null },
          post: baseWhere,
        },
        _count: { _all: true },
      }),
    ]);

    const classIds = classGroups
      .map((group) => group.classId)
      .filter((classId): classId is string => typeof classId === "string");
    const classes = await this.prisma.class.findMany({
      where: { id: { in: classIds }, campusId },
      select: { id: true, name: true },
    });
    const classNames = new Map(classes.map((item) => [item.id, item.name]));

    return {
      allCount,
      classCount,
      classes: classGroups
        .flatMap((group) => {
          if (!group.classId) return [];
          return [
            {
              classId: group.classId,
              className: classNames.get(group.classId) ?? group.classId,
              count:
                typeof group._count === "object" ? (group._count._all ?? 0) : 0,
            },
          ];
        })
        .sort((a, b) => a.className.localeCompare(b.className)),
    };
  }

  private buildViewerVisibilityWhere(viewer?: User): Record<string, any> {
    if (!viewer || viewer.profile?.type !== "guardian") return {};

    const guardianId = viewer.profile.id;

    return {
      AND: [
        {
          OR: [
            { audiences: { some: { type: AudienceType.ALL } } },
            {
              audiences: {
                some: {
                  type: AudienceType.CLASS,
                  class: {
                    enrollments: {
                      some: {
                        endDate: null,
                        student: {
                          guardians: {
                            some: { guardianId },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    };
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

  private getStringFilterValue(filter: unknown): string | null {
    if (typeof filter === "string") return filter;
    if (typeof filter === "object" && filter !== null && "eq" in filter) {
      const value = (filter as { eq?: unknown }).eq;
      return typeof value === "string" ? value : null;
    }
    return null;
  }

  private buildPostStatusWhere(
    filter: unknown,
  ): PostStatus | { in: PostStatus[] } | null {
    const validStatuses = new Set<string>(Object.values(PostStatus));
    const normalize = (value: unknown): PostStatus | null => {
      if (typeof value !== "string" || !validStatuses.has(value)) return null;
      return value as PostStatus;
    };

    const direct = normalize(filter);
    if (direct) return direct;

    if (typeof filter === "object" && filter !== null && "eq" in filter) {
      return normalize((filter as { eq?: unknown }).eq);
    }

    if (typeof filter === "object" && filter !== null && "in" in filter) {
      const values = (filter as { in?: unknown }).in;
      if (!Array.isArray(values)) return null;
      const statuses = values
        .map(normalize)
        .filter((value): value is PostStatus => value !== null);
      return statuses.length > 0 ? { in: statuses } : null;
    }

    return null;
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

  async findPinnedByCampus(campusId: string, viewer?: User): Promise<Post[]> {
    const now = new Date();
    const posts = (await this.prisma.post.findMany({
      where: {
        campusId,
        isPinned: true,
        isDeleted: false,
        AND: [
          this.buildViewerVisibilityWhere(viewer),
          { OR: [{ pinnedUntil: null }, { pinnedUntil: { gt: now } }] },
        ],
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
