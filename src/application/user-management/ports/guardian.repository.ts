/**
 * Guardian Repository Port (Interface)
 * Defines the contract for guardian data access
 * Implementation will be provided by infrastructure layer
 */

import { Guardian } from '@/domain/user-management/entities/guardian.entity';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { PaginatedResult } from '@/core/modules/standard-response/dto/query.dto';

export abstract class GuardianRepository {
  /**
   * Find guardian by ID
   */
  abstract findById(id: string): Promise<Guardian | null>;

  /**
   * Find guardian by email
   */
  abstract findByEmail(email: string): Promise<Guardian | null>;

  /**
   * Find guardian by phone number
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Guardian | null>;

  /**
   * Find all guardians with filtering, sorting, pagination using StandardRequest
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Guardian>>;

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
}
