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
  IdempotentCreatePostOptions,
  IdempotentCreatePostResult,
  IdempotentPostRecord,
  UpdatePostOptions,
} from "@/application/content-management/ports/post.repository";
import { PrismaTransactionClient } from "./base.transaction-ops";

const APPROVAL_REQUEST_INCLUDE = PrismaPostApprovalRequestMapper.include;

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

  async findPostByIdForUpdate(id: string): Promise<Post | null> {
    const rows = await this.tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM post
      WHERE id = ${id}::uuid
        AND is_deleted = false
      FOR UPDATE
    `;
    if (rows.length === 0) return null;

    const post = await this.tx.post.findUnique({
      where: { id },
      include: POST_INCLUDE,
    });
    return post ? PrismaPostMapper.toDomain(post) : null;
  }

  async findPostByClientMutationId(
    campusId: string,
    authorId: string,
    clientMutationId: string,
  ): Promise<IdempotentPostRecord | null> {
    const post = await this.tx.post.findFirst({
      where: {
        campusId,
        authorId,
        clientMutationId,
      },
      include: POST_INCLUDE,
    });

    return post
      ? {
          post: PrismaPostMapper.toDomain(post),
          requestPayloadHash: post.requestPayloadHash,
        }
      : null;
  }

  async createPost(post: Post, options?: CreatePostOptions): Promise<Post> {
    return this.createPostRecord(post, options);
  }

  private async createPostRecord(
    post: Post,
    options?: CreatePostOptions & {
      clientMutationId?: string;
      requestPayloadHash?: string;
    },
  ): Promise<Post> {
    const created = await this.tx.post.create({
      data: {
        ...PrismaPostMapper.toPrisma(post),
        ...(options?.clientMutationId
          ? { clientMutationId: options.clientMutationId }
          : {}),
        ...(options?.requestPayloadHash
          ? { requestPayloadHash: options.requestPayloadHash }
          : {}),
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

  async createPostIdempotently(
    post: Post,
    options: IdempotentCreatePostOptions,
  ): Promise<IdempotentCreatePostResult> {
    // A unique-constraint race would abort the transaction. Serialize this key
    // so a waiter can read and return the winner instead.
    const lockKey = `${post.campusId}:${post.authorId}:${options.clientMutationId}`;
    await this.tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))::text
    `;

    const existing = await this.findPostByClientMutationId(
      post.campusId,
      post.authorId,
      options.clientMutationId,
    );
    if (existing) {
      return { ...existing, created: false };
    }

    const created = await this.createPostRecord(post, options);
    return {
      post: created,
      requestPayloadHash: options.requestPayloadHash,
      created: true,
    };
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

  async lockPostPinCapacity(campusId: string): Promise<void> {
    await this.lockCampusRow(campusId);
  }

  async countEffectivePinnedPosts(
    campusId: string,
    now: Date,
  ): Promise<number> {
    return this.tx.post.count({
      where: {
        campusId,
        isDeleted: false,
        status: "PUBLISHED",
        isPinned: true,
        OR: [{ pinnedUntil: null }, { pinnedUntil: { gt: now } }],
      },
    });
  }

  async updatePostPin(
    id: string,
    data: {
      isPinned: boolean;
      pinnedById: string | null;
      pinnedUntil: Date | null;
    },
  ): Promise<Post> {
    const updated = await this.tx.post.update({
      where: { id },
      data: {
        isPinned: data.isPinned,
        pinnedById: data.pinnedById,
        pinnedUntil: data.pinnedUntil,
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

  async lockPostCategoryCampus(campusId: string): Promise<void> {
    await this.lockCampusRow(campusId);
  }

  async findPostCategoryByIdForUpdate(
    id: string,
  ): Promise<PostCategory | null> {
    const rows = await this.tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM post_category
      WHERE id = ${id}::uuid
      FOR UPDATE
    `;
    if (rows.length === 0) return null;

    const category = await this.tx.postCategory.findUnique({ where: { id } });
    return category ? PrismaPostCategoryMapper.toDomain(category) : null;
  }

  async findActivePostCategoriesForUpdate(
    campusId: string,
  ): Promise<PostCategory[]> {
    const rows = await this.tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM post_category
      WHERE campus_id = ${campusId}::uuid
        AND is_archived = false
      ORDER BY "order", id
      FOR UPDATE
    `;
    if (rows.length === 0) return [];

    const categories = await this.tx.postCategory.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    return PrismaPostCategoryMapper.toDomainArray(categories);
  }

  async findPostCategoryByName(
    campusId: string,
    name: string,
  ): Promise<PostCategory | null> {
    const category = await this.tx.postCategory.findFirst({
      where: { campusId, name: { equals: name, mode: "insensitive" } },
    });
    return category ? PrismaPostCategoryMapper.toDomain(category) : null;
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
    const active = await this.findActivePostCategoriesForUpdate(campusId);
    const activeIds = active.map((category) => category.id.toString());
    if (
      activeIds.length !== ids.length ||
      ids.some((id) => !activeIds.includes(id))
    ) {
      throw new Error("Post category active set changed during reorder");
    }

    const now = new Date();
    const maximumOrder = active.reduce(
      (maximum, category) => Math.max(maximum, category.order),
      0,
    );
    const temporaryBase = maximumOrder + ids.length + 1;
    for (const [index, id] of ids.entries()) {
      await this.tx.postCategory.update({
        where: { id },
        data: { order: temporaryBase + index, updatedAt: now },
      });
    }
    for (const [index, id] of ids.entries()) {
      await this.tx.postCategory.update({
        where: { id },
        data: { order: index + 1, updatedAt: now },
      });
    }

    const rows = await this.tx.postCategory.findMany({
      where: { campusId, isArchived: false },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    return PrismaPostCategoryMapper.toDomainArray(rows);
  }

  async upsertCampusSetting(setting: CampusSetting): Promise<CampusSetting> {
    await this.lockCampusSetting(setting.campusId);
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
      include: APPROVAL_REQUEST_INCLUDE,
    });
    return PrismaPostApprovalRequestMapper.toDomain(updated);
  }

  async findLatestPostApprovalRequestForUpdate(
    postId: string,
  ): Promise<PostApprovalRequest | null> {
    const rows = await this.tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM post_approval_request
      WHERE post_id = ${postId}::uuid
      ORDER BY submitted_at DESC, created_at DESC, id DESC
      LIMIT 1
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;

    const request = await this.tx.postApprovalRequest.findUnique({
      where: { id: row.id },
      include: APPROVAL_REQUEST_INCLUDE,
    });
    return request ? PrismaPostApprovalRequestMapper.toDomain(request) : null;
  }

  async findPendingPostApprovalRequestForUpdate(
    postId: string,
  ): Promise<PostApprovalRequest | null> {
    const rows = await this.tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM post_approval_request
      WHERE post_id = ${postId}::uuid
        AND status = 'PENDING'
      ORDER BY submitted_at DESC, created_at DESC, id DESC
      LIMIT 1
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;

    const request = await this.tx.postApprovalRequest.findUnique({
      where: { id: row.id },
      include: APPROVAL_REQUEST_INCLUDE,
    });
    return request ? PrismaPostApprovalRequestMapper.toDomain(request) : null;
  }

  async updatePostApprovalRequestIfPending(
    request: PostApprovalRequest,
  ): Promise<PostApprovalRequest> {
    const result = await this.tx.postApprovalRequest.updateMany({
      where: { id: request.id, status: "PENDING" },
      data: {
        status: request.status,
        reviewedById: request.reviewedById,
        reviewedAt: request.reviewedAt,
        reviewNote: request.reviewNote,
      },
    });
    if (result.count !== 1) {
      throw new Error("Post approval request is no longer pending");
    }

    const updated = await this.tx.postApprovalRequest.findUnique({
      where: { id: request.id },
      include: APPROVAL_REQUEST_INCLUDE,
    });
    if (!updated) {
      throw new Error("Post approval request not found after update");
    }
    return PrismaPostApprovalRequestMapper.toDomain(updated);
  }

  async findCampusSettingByCampusIdForUpdate(
    campusId: string,
  ): Promise<CampusSetting | null> {
    await this.lockCampusSetting(campusId);
    const rows = await this.tx.$queryRaw<Array<{ id: string }>>`
      SELECT id
      FROM campus_setting
      WHERE campus_id = ${campusId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;

    const setting = await this.tx.campusSetting.findUnique({
      where: { id: row.id },
    });
    return setting ? PrismaCampusSettingMapper.toDomain(setting) : null;
  }

  private async lockCampusRow(campusId: string): Promise<void> {
    await this.tx.$queryRaw`
      SELECT set_config('lock_timeout', '3s', true)
    `;
    await this.tx.$queryRaw`
      SELECT id
      FROM campus
      WHERE id = ${campusId}::uuid
      FOR UPDATE
    `;
  }

  private async lockCampusSetting(campusId: string): Promise<void> {
    const lockKey = `cms-campus-setting:${campusId}`;
    await this.tx.$queryRaw`
      SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0::bigint))::text
    `;
  }
}
