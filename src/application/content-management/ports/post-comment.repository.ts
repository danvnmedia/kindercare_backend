/**
 * PostComment Repository Port (Interface)
 * Defines the contract for post comment data access
 * Implementation will be provided by infrastructure layer
 */

import { PostComment } from "@/domain/content-management";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class PostCommentRepository {
  /**
   * Find comment by ID
   */
  abstract findById(id: string): Promise<PostComment | null>;

  /**
   * Find all comments for a post with pagination
   * Returns flat list - use findRootCommentsByPostId for hierarchical display
   */
  abstract findByPostId(
    postId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostComment>>;

  /**
   * Find root-level comments (depth = 0) for a post with pagination
   * Used for initial comment list display
   */
  abstract findRootCommentsByPostId(
    postId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostComment>>;

  /**
   * Find all replies to a specific comment
   * Used for loading nested replies
   */
  abstract findRepliesByCommentId(commentId: string): Promise<PostComment[]>;

  /**
   * Count total comments for a post (including deleted for audit)
   */
  abstract countByPost(postId: string): Promise<number>;

  /**
   * Count active (non-deleted) comments for a post
   */
  abstract countActiveByPost(postId: string): Promise<number>;

  /**
   * Save a new comment
   */
  abstract save(comment: PostComment): Promise<PostComment>;

  /**
   * Update existing comment (content edit)
   */
  abstract update(comment: PostComment): Promise<PostComment>;

  /**
   * Soft delete a comment
   * Sets isDeleted = true, deletedAt, deletedById
   */
  abstract softDelete(id: string, deletedById: string): Promise<void>;
}
