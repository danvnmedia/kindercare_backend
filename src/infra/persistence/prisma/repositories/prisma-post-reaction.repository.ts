import { PostReactionRepository } from "@/application/content-management/ports/post-reaction.repository";
import { PostReaction } from "@/domain/content-management";
import { Injectable } from "@nestjs/common";
import { PrismaPostReactionMapper } from "../mapper/prisma-post-reaction.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaPostReactionRepository implements PostReactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByPostAndUser(
    postId: string,
    userId: string,
  ): Promise<PostReaction | null> {
    const prismaReaction = await this.prisma.postReaction.findFirst({
      where: {
        postId,
        userId,
      },
    });
    return prismaReaction
      ? PrismaPostReactionMapper.toDomain(prismaReaction)
      : null;
  }

  async existsByPostAndUser(postId: string, userId: string): Promise<boolean> {
    const count = await this.prisma.postReaction.count({
      where: {
        postId,
        userId,
      },
    });
    return count > 0;
  }

  async countByPost(postId: string): Promise<number> {
    return await this.prisma.postReaction.count({
      where: { postId },
    });
  }

  async findUserIdsByPost(postId: string): Promise<string[]> {
    const reactions = await this.prisma.postReaction.findMany({
      where: { postId },
      select: { userId: true },
    });
    return reactions.map((r) => r.userId);
  }

  async findByPostId(postId: string): Promise<PostReaction[]> {
    const prismaReactions = await this.prisma.postReaction.findMany({
      where: { postId },
    });
    return PrismaPostReactionMapper.toDomainArray(prismaReactions);
  }

  async save(reaction: PostReaction): Promise<PostReaction> {
    const prismaData = PrismaPostReactionMapper.toPrisma(reaction);
    const created = await this.prisma.postReaction.create({
      data: prismaData,
    });
    return PrismaPostReactionMapper.toDomain(created);
  }

  async delete(postId: string, userId: string): Promise<void> {
    await this.prisma.postReaction.deleteMany({
      where: {
        postId,
        userId,
      },
    });
  }
}
