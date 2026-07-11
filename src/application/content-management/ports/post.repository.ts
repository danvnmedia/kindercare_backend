import { Post } from "@/domain/content-management";
import { User } from "@/domain/user-management/user.entity";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface CreatePostOptions {
  categoryIds?: string[];
}

export interface IdempotentCreatePostOptions extends CreatePostOptions {
  clientMutationId: string;
  requestPayloadHash: string;
}

export interface IdempotentPostRecord {
  post: Post;
  requestPayloadHash: string;
}

export interface IdempotentCreatePostResult extends IdempotentPostRecord {
  created: boolean;
}

export interface UpdatePostOptions {
  categoryIds?: string[];
}

export interface PostClassFacet {
  classId: string;
  className: string;
  count: number;
}

export interface PostAudienceFacets {
  allCount: number;
  classCount: number;
  classes: PostClassFacet[];
}

export abstract class PostRepository {
  abstract create(post: Post, options?: CreatePostOptions): Promise<Post>;
  abstract update(
    id: string,
    data: Post,
    options?: UpdatePostOptions,
  ): Promise<Post>;
  abstract delete(id: string): Promise<void>;
  abstract findById(id: string): Promise<Post | null>;
  abstract findVisibleById(
    id: string,
    campusId: string,
    viewer: User,
  ): Promise<Post | null>;
  /**
   * Find posts with filtering, sorting, pagination
   * @param query - Standard query parameters (filters, sorts, pagination)
   * @param scope - Optional system-enforced filters (e.g., campusId) that bypass allowedFilterFields
   */
  abstract findMany(
    query: StandardRequestDto,
    scope?: Record<string, any>,
    viewer?: User,
  ): Promise<PaginatedResult<Post>>;

  /** CMS-only post audience/class facets for management filters. */
  abstract findAudienceFacets(
    campusId: string,
    query: StandardRequestDto,
    viewer?: User,
  ): Promise<PostAudienceFacets>;

  /**
   * Count the number of active pinned posts for a campus.
   * Excludes posts with expired pins.
   */
  abstract countPinnedByCampus(campusId: string): Promise<number>;

  /**
   * Find all active pinned posts for a campus.
   * Excludes posts with expired pins.
   * Orders by createdAt descending.
   */
  abstract findPinnedByCampus(campusId: string, viewer?: User): Promise<Post[]>;
}
