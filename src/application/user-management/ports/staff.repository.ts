/**
 * Staff Repository Port (Interface)
 * Defines the contract for staff data access
 * Implementation will be provided by infrastructure layer
 */

import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StaffRepository {
  /**
   * Find staff by ID
   */
  abstract findById(id: string): Promise<Staff | null>;

  /**
   * Find staff by email
   */
  abstract findByEmail(email: string): Promise<Staff | null>;

  /**
   * Find staff by phone number
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Staff | null>;

  /**
   * Find staff by user ID
   */
  abstract findByUserId(userId: string): Promise<Staff | null>;

  /**
   * Find staff by type
   */
  abstract findByType(type: StaffType): Promise<Staff[]>;

  /**
   * Find multiple staff by IDs
   */
  abstract findByIds(ids: string[]): Promise<Staff[]>;

  /**
   * Find all staff with filtering, sorting, pagination using StandardRequest
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Staff>>;

  /**
   * Save a new staff
   */
  abstract save(staff: Staff): Promise<Staff>;

  /**
   * Update existing staff
   */
  abstract update(staff: Staff): Promise<Staff>;

  /**
   * Delete staff
   */
  abstract delete(id: string): Promise<void>;
}
