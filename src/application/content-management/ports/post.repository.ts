import { Post } from "@/domain/content-management";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface CreatePostOptions {
  categoryIds?: string[];
}

export interface UpdatePostOptions {
  categoryIds?: string[];
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
  abstract findMany(query: StandardRequestDto): Promise<PaginatedResult<Post>>;

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
  abstract findPinnedByCampus(campusId: string): Promise<Post[]>;
}
