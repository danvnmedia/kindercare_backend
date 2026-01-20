import { Injectable } from "@nestjs/common";
import { PostRepository } from "@/application/content-management/ports/post.repository";
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

  async create(post: Post): Promise<Post> {
    const prismaPost = PrismaPostMapper.toPrisma(post);
    const createdPost = await this.prisma.post.create({
      data: {
        ...prismaPost,
        audiences: {
          create: post.audiences.map((audience) =>
            PrismaPostMapper.toPrismaPostAudienceCreate(audience),
          ),
        },
      },
      include: {
        author: true,
        audiences: true,
        attachments: true,
      },
    });
    return PrismaPostMapper.toDomain(createdPost);
  }

  async update(id: string, data: Post): Promise<Post> {
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
      },
      include: {
        author: true,
        audiences: true,
        attachments: true,
      },
    });
    return PrismaPostMapper.toDomain(updatedPost);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.post.delete({ where: { id } });
  }

  async findById(id: string): Promise<Post | null> {
    const post = (await this.prisma.post.findUnique({
      where: { id },
      include: {
        author: {
          include: {
            guardians: true,
            staffs: true,
          },
        },
        audiences: true,
        attachments: true,
      },
    })) as PrismaPostWithRelations | null;
    return post ? PrismaPostMapper.toDomain(post) : null;
  }

  async findMany(
    query: StandardRequestDto,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Post>> {
    query.allowedFilterFields = [
      "title",
      "content",
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

    return await this.queryService.executeQuery<Post>(
      this.prisma,
      "post",
      query,
      {
        include: {
          author: {
            include: {
              guardian: true,
              staff: true,
            },
          },
          audiences: true,
          attachments: true,
        },
        scope,
      },
      PrismaPostMapper,
    );
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
        audiences: true,
        attachments: true,
      },
    })) as PrismaPostWithRelations[];

    return posts.map((post) => PrismaPostMapper.toDomain(post));
  }
}
