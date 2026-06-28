import { PostCategoryRepository } from "@/application/content-management/ports/post-category.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PostCategory } from "@/domain/content-management";
import { Injectable } from "@nestjs/common";
import { PrismaPostCategoryMapper } from "../mapper/prisma-post-category.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaPostCategoryRepository implements PostCategoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}

  async findById(id: string): Promise<PostCategory | null> {
    const prismaCategory = await this.prisma.postCategory.findUnique({
      where: { id },
    });
    return prismaCategory
      ? PrismaPostCategoryMapper.toDomain(prismaCategory)
      : null;
  }

  async findByCampusId(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostCategory>> {
    params.allowedFilterFields = ["name", "isArchived", "order"];
    params.allowedSortFields = ["createdAt", "updatedAt", "order", "name"];

    return await this.queryService.executeQuery<PostCategory>(
      this.prisma,
      "postCategory",
      params,
      {
        where: { campusId },
      },
      PrismaPostCategoryMapper,
    );
  }

  async findByNameInCampus(
    campusId: string,
    name: string,
  ): Promise<PostCategory | null> {
    const prismaCategory = await this.prisma.postCategory.findFirst({
      where: {
        campusId,
        name: {
          equals: name,
          mode: "insensitive",
        },
      },
    });
    return prismaCategory
      ? PrismaPostCategoryMapper.toDomain(prismaCategory)
      : null;
  }

  async findNonArchivedByCampusId(campusId: string): Promise<PostCategory[]> {
    const prismaCategories = await this.prisma.postCategory.findMany({
      where: {
        campusId,
        isArchived: false,
      },
      orderBy: {
        order: "asc",
      },
    });
    return PrismaPostCategoryMapper.toDomainArray(prismaCategories);
  }

  async getMaxOrder(campusId: string): Promise<number> {
    const result = await this.prisma.postCategory.aggregate({
      where: { campusId },
      _max: {
        order: true,
      },
    });
    return result._max.order ?? 0;
  }

  async save(category: PostCategory): Promise<PostCategory> {
    const prismaData = PrismaPostCategoryMapper.toPrisma(category);
    const created = await this.prisma.postCategory.create({
      data: prismaData,
    });
    return PrismaPostCategoryMapper.toDomain(created);
  }

  async update(category: PostCategory): Promise<PostCategory> {
    const prismaData = PrismaPostCategoryMapper.toPrismaUpdate(category);
    const updated = await this.prisma.postCategory.update({
      where: { id: category.id },
      data: prismaData,
    });
    return PrismaPostCategoryMapper.toDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.postCategory.delete({
      where: { id },
    });
  }

  async reorder(campusId: string, ids: string[]): Promise<PostCategory[]> {
    // Update each category's order based on its position in the array
    const updatePromises = ids.map((id, index) =>
      this.prisma.postCategory.update({
        where: { id },
        data: { order: index + 1, updatedAt: new Date() },
      }),
    );

    await Promise.all(updatePromises);

    // Fetch and return the reordered categories
    const reorderedCategories = await this.prisma.postCategory.findMany({
      where: { campusId, id: { in: ids } },
      orderBy: { order: "asc" },
    });

    return PrismaPostCategoryMapper.toDomainArray(reorderedCategories);
  }
}
