/**
 * PostCategory Repository Port (Interface)
 * Defines the contract for post category data access
 * Implementation will be provided by infrastructure layer
 */

import { PostCategory } from "@/domain/content-management";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class PostCategoryRepository {
  /**
   * Find category by ID
   */
  abstract findById(id: string): Promise<PostCategory | null>;

  /**
   * Find all categories for a campus with pagination, filtering, and sorting
   */
  abstract findByCampusId(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostCategory>>;

  /**
   * Find category by name within a specific campus (for uniqueness check)
   */
  abstract findByNameInCampus(
    campusId: string,
    name: string,
  ): Promise<PostCategory | null>;

  /**
   * Find all active categories for a campus (for dropdown/selection)
   */
  abstract findActivesByCampusId(campusId: string): Promise<PostCategory[]>;

  /**
   * Get the maximum order value for categories in a campus
   * Used when creating new categories to assign the next order
   */
  abstract getMaxOrder(campusId: string): Promise<number>;

  /**
   * Save a new category
   */
  abstract save(category: PostCategory): Promise<PostCategory>;

  /**
   * Update existing category
   */
  abstract update(category: PostCategory): Promise<PostCategory>;

  /**
   * Delete category by ID
   * Note: Consider checking for posts using this category before deletion
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Reorder categories within a campus based on the provided array of IDs
   * The order field will be set based on the array index (index 0 = order 1, etc.)
   * @param campusId - Campus to scope the reorder operation to
   * @param ids - Array of category IDs in the desired order
   * @returns Updated categories sorted by new order
   */
  abstract reorder(campusId: string, ids: string[]): Promise<PostCategory[]>;
}
