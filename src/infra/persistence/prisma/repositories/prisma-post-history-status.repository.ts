import { Injectable } from "@nestjs/common";
import { PostHistoryStatusRepository } from "@/application/content-management/ports/post-history-status.repository";
import { PostHistoryStatus } from "@/domain/content-management/entities/post-history-status.entity";
import { PrismaService } from "../prisma.service";
import { PrismaPostHistoryStatusMapper } from "../mapper/prisma-post-history-status.mapper";

@Injectable()
export class PrismaPostHistoryStatusRepository
  implements PostHistoryStatusRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    postHistoryStatus: PostHistoryStatus,
  ): Promise<PostHistoryStatus> {
    const prismaPostHistoryStatus =
      PrismaPostHistoryStatusMapper.toPrisma(postHistoryStatus);
    const createdPostHistoryStatus = await this.prisma.postHistoryStatus.create(
      {
        data: prismaPostHistoryStatus,
      },
    );
    return PrismaPostHistoryStatusMapper.toDomain(createdPostHistoryStatus);
  }

  async findByPostId(postId: string): Promise<PostHistoryStatus[]> {
    const postHistoryStatuses = await this.prisma.postHistoryStatus.findMany({
      where: { postId },
      orderBy: {
        createdAt: "desc",
      },
    });
    return postHistoryStatuses.map(PrismaPostHistoryStatusMapper.toDomain);
  }
}
