import {
  CampusSetting,
  Post,
  PostApprovalRequest,
  PostCategory,
  PostHistoryStatus,
} from "@/domain/content-management";
import {
  PrismaCampusSettingMapper,
  PrismaPostApprovalRequestMapper,
  PrismaPostCategoryMapper,
  PrismaPostHistoryStatusMapper,
  PrismaPostMapper,
} from "../../mapper";
import {
  CreatePostOptions,
  UpdatePostOptions,
} from "@/application/content-management/ports/post.repository";
import { PrismaTransactionClient } from "./base.transaction-ops";

const POST_INCLUDE = {
  author: true,
  audiences: {
    include: {
      class: { select: { id: true, name: true } },
    },
  },
  attachments: { include: { file: true } },
  categories: { include: { category: true } },
};

export class ContentManagementTransactionOps {
  constructor(private readonly tx: PrismaTransactionClient) {}

  async createPost(post: Post, options?: CreatePostOptions): Promise<Post> {
    const created = await this.tx.post.create({
      data: {
        ...PrismaPostMapper.toPrisma(post),
        audiences: {
          create: post.audiences.map((audience) =>
            PrismaPostMapper.toPrismaPostAudienceCreate(audience),
          ),
        },
        ...(options?.categoryIds?.length
          ? {
              categories: {
                create: options.categoryIds.map((categoryId) => ({
                  categoryId,
                })),
              },
            }
          : {}),
      },
      include: POST_INCLUDE,
    });

    return PrismaPostMapper.toDomain(created);
  }

  async updatePost(
    id: string,
    post: Post,
    options?: UpdatePostOptions,
  ): Promise<Post> {
    const updated = await this.tx.post.update({
      where: { id },
      data: {
        ...PrismaPostMapper.toPrisma(post),
        audiences: {
          deleteMany: {},
          create: post.audiences.map((audience) =>
            PrismaPostMapper.toPrismaPostAudienceCreate(audience),
          ),
        },
        ...(options?.categoryIds !== undefined
          ? {
              categories: {
                deleteMany: {},
                ...(options.categoryIds.length
                  ? {
                      create: options.categoryIds.map((categoryId) => ({
                        categoryId,
                      })),
                    }
                  : {}),
              },
            }
          : {}),
      },
      include: POST_INCLUDE,
    });

    return PrismaPostMapper.toDomain(updated);
  }

  async deletePost(id: string): Promise<void> {
    await this.tx.post.update({
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

  async createPostCategory(category: PostCategory): Promise<PostCategory> {
    const created = await this.tx.postCategory.create({
      data: PrismaPostCategoryMapper.toPrisma(category),
    });
    return PrismaPostCategoryMapper.toDomain(created);
  }

  async updatePostCategory(category: PostCategory): Promise<PostCategory> {
    const updated = await this.tx.postCategory.update({
      where: { id: category.id },
      data: PrismaPostCategoryMapper.toPrismaUpdate(category),
    });
    return PrismaPostCategoryMapper.toDomain(updated);
  }

  async deletePostCategory(id: string): Promise<void> {
    await this.tx.postCategory.delete({ where: { id } });
  }

  async reorderPostCategories(
    campusId: string,
    ids: string[],
  ): Promise<PostCategory[]> {
    const now = new Date();

    for (const [index, id] of ids.entries()) {
      const result = await this.tx.postCategory.updateMany({
        where: { id, campusId },
        data: { order: index + 1, updatedAt: now },
      });
      if (result.count !== 1) {
        throw new Error(`Post category ${id} not found in campus ${campusId}`);
      }
    }

    const rows = await this.tx.postCategory.findMany({
      where: { campusId, id: { in: ids } },
      orderBy: { order: "asc" },
    });
    return PrismaPostCategoryMapper.toDomainArray(rows);
  }

  async upsertCampusSetting(setting: CampusSetting): Promise<CampusSetting> {
    const upserted = await this.tx.campusSetting.upsert({
      where: { campusId: setting.campusId },
      create: PrismaCampusSettingMapper.toPrisma(setting),
      update: PrismaCampusSettingMapper.toPrismaUpdate(setting),
    });
    return PrismaCampusSettingMapper.toDomain(upserted);
  }

  async createPostHistoryStatus(
    status: PostHistoryStatus,
  ): Promise<PostHistoryStatus> {
    const created = await this.tx.postHistoryStatus.create({
      data: PrismaPostHistoryStatusMapper.toPrisma(status),
    });
    return PrismaPostHistoryStatusMapper.toDomain(created);
  }

  async createPostApprovalRequest(
    request: PostApprovalRequest,
  ): Promise<PostApprovalRequest> {
    const created = await this.tx.postApprovalRequest.create({
      data: PrismaPostApprovalRequestMapper.toPrisma(request),
      include: { submittedBy: true, reviewedBy: true },
    });
    return PrismaPostApprovalRequestMapper.toDomain(created);
  }

  async updatePostApprovalRequest(
    request: PostApprovalRequest,
  ): Promise<PostApprovalRequest> {
    const updated = await this.tx.postApprovalRequest.update({
      where: { id: request.id },
      data: PrismaPostApprovalRequestMapper.toPrismaUpdate(request),
      include: { submittedBy: true, reviewedBy: true },
    });
    return PrismaPostApprovalRequestMapper.toDomain(updated);
  }
}
