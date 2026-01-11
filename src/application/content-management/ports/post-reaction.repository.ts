/**
 * PostReaction Repository Port (Interface)
 * Defines the contract for post reaction data access
 * Implementation will be provided by infrastructure layer
 */

import { PostReaction } from "@/domain/content-management";

export abstract class PostReactionRepository {
  /**
   * Find reaction by post and user (for toggle check)
   */
  abstract findByPostAndUser(
    postId: string,
    userId: string,
  ): Promise<PostReaction | null>;

  /**
   * Check if a user has reacted to a post
   */
  abstract existsByPostAndUser(
    postId: string,
    userId: string,
  ): Promise<boolean>;

  /**
   * Count total reactions for a post
   */
  abstract countByPost(postId: string): Promise<number>;

  /**
   * Get all user IDs who reacted to a post (for displaying who liked)
   */
  abstract findUserIdsByPost(postId: string): Promise<string[]>;

  /**
   * Find all reactions for a post (with user info if needed)
   */
  abstract findByPostId(postId: string): Promise<PostReaction[]>;

  /**
   * Save a new reaction (create)
   */
  abstract save(reaction: PostReaction): Promise<PostReaction>;

  /**
   * Delete a reaction (toggle off)
   * Uses composite key of postId and userId
   */
  abstract delete(postId: string, userId: string): Promise<void>;
}
