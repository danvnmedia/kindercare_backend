/**
 * PostApprovalRequest Repository Port (Interface)
 * Defines the contract for post approval request data access
 * Implementation will be provided by infrastructure layer
 */

import {
  PostApprovalRequest,
  ApprovalStatus,
} from "@/domain/content-management";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class PostApprovalRequestRepository {
  /**
   * Find approval request by ID
   */
  abstract findById(id: string): Promise<PostApprovalRequest | null>;

  /**
   * Find all approval requests for a post (history)
   */
  abstract findByPostId(postId: string): Promise<PostApprovalRequest[]>;

  /**
   * Find the latest/most recent approval request for a post
   */
  abstract findLatestByPostId(
    postId: string,
  ): Promise<PostApprovalRequest | null>;

  /**
   * Find all pending approval requests for a campus with pagination
   * Used for admin approval queue
   */
  abstract findPendingByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostApprovalRequest>>;

  /**
   * Find approval requests by status within a campus
   */
  abstract findByCampusAndStatus(
    campusId: string,
    status: ApprovalStatus,
    params: StandardRequest,
  ): Promise<PaginatedResult<PostApprovalRequest>>;

  /**
   * Count pending approval requests for a campus
   * Used for badge/notification count
   */
  abstract countPendingByCampus(campusId: string): Promise<number>;

  /**
   * Save a new approval request
   */
  abstract save(request: PostApprovalRequest): Promise<PostApprovalRequest>;

  /**
   * Update approval request (approve/reject)
   */
  abstract update(request: PostApprovalRequest): Promise<PostApprovalRequest>;
}
