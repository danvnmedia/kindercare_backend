/**
 * Guardian Repository Port (Interface)
 * Defines the contract for guardian data access
 * Implementation will be provided by infrastructure layer
 */

import { Guardian } from "../../../domain/user-management/guardian.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export interface GuardianRepository {
  /**
   * Find guardian by ID
   */
  findById(id: string): Promise<Guardian | null>;

  /**
   * Find guardian by email
   */
  findByEmail(email: string): Promise<Guardian | null>;

  /**
   * Find guardian by phone number
   */
  findByPhoneNumber(phoneNumber: string): Promise<Guardian | null>;

  /**
   * Find all guardians with filtering, sorting, pagination using StandardRequest
   */
  findAll(params: StandardRequest): Promise<PaginatedResult<Guardian>>;

  /**
   * Find multiple guardians by IDs
   */
  findByIds(ids: string[]): Promise<Guardian[]>;

  /**
   * Save a new guardian
   */
  save(
    guardian: Omit<Guardian, "id" | "createdAt" | "updatedAt">,
  ): Promise<Guardian>;

  /**
   * Update existing guardian
   */
  update(id: string, data: Partial<Guardian>): Promise<Guardian>;

  /**
   * Delete guardian
   */
  delete(id: string): Promise<void>;

  /**
   * Get guardian's children (students)
   */
  getGuardianChildren(guardianId: string): Promise<any[]>;
}
