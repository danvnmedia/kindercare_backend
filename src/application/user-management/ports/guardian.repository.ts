/**
 * Guardian Repository Port (Interface)
 * Defines the contract for guardian data access
 * Implementation will be provided by infrastructure layer
 */

import {
  Guardian,
  GuardianStudent,
} from "@/domain/user-management/entities/guardian.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class GuardianRepository {
  /**
   * Find guardian by ID
   */
  abstract findById(id: string): Promise<Guardian | null>;

  /**
   * Find guardian by email (global search across all campuses)
   */
  abstract findByEmail(email: string): Promise<Guardian | null>;

  /**
   * Find guardian by email within a specific campus (campus-scoped uniqueness)
   */
  abstract findByEmailInCampus(
    campusId: string,
    email: string,
  ): Promise<Guardian | null>;

  /**
   * Find guardian by phone number (global search across all campuses)
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Guardian | null>;

  /**
   * Find guardian by phone number within a specific campus (campus-scoped uniqueness)
   */
  abstract findByPhoneNumberInCampus(
    campusId: string,
    phoneNumber: string,
  ): Promise<Guardian | null>;

  /**
   * Find guardian by user ID
   */
  abstract findByUserId(userId: string): Promise<Guardian | null>;

  /**
   * Find an active guardian by user ID within a specific campus.
   */
  abstract findByUserIdInCampus(
    userId: string,
    campusId: string,
  ): Promise<Guardian | null>;

  /**
   * Find guardians by campus ID
   */
  abstract findByCampusId(campusId: string): Promise<Guardian[]>;

  /**
   * Find all guardians with filtering, sorting, pagination using StandardRequest
   * @param params - Standard query parameters (filters, sorts, pagination)
   * @param scope - Optional system-enforced filters (e.g., campusId) that bypass allowedFilterFields
   */
  abstract findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Guardian>>;

  /**
   * Find multiple guardians by IDs
   */
  abstract findByIds(ids: string[]): Promise<Guardian[]>;

  /**
   * Save a new guardian
   */
  abstract save(guardian: Guardian): Promise<Guardian>;

  /**
   * Update existing guardian
   */
  abstract update(guardian: Guardian): Promise<Guardian>;

  /**
   * Delete guardian
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Get guardian's children (students)
   */
  abstract getGuardianChildren(guardianId: string): Promise<any[]>;

  /**
   * Get a guardian's active children in a specific campus.
   */
  abstract getGuardianChildrenInCampus(
    guardianId: string,
    campusId: string,
  ): Promise<GuardianStudent[]>;
}
