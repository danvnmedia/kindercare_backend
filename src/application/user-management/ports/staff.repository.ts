/**
 * Staff Repository Port (Interface)
 * Defines the contract for staff data access
 * Implementation will be provided by infrastructure layer
 */

import { Staff } from "@/domain/user-management/entities/staff.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StaffRepository {
  /**
   * Find staff by ID
   */
  abstract findById(id: string): Promise<Staff | null>;

  /**
   * Find staff by email (global search across all campuses)
   */
  abstract findByEmail(email: string): Promise<Staff | null>;

  /**
   * Find staff by email within a specific campus (campus-scoped uniqueness)
   */
  abstract findByEmailInCampus(
    campusId: string,
    email: string,
  ): Promise<Staff | null>;

  /**
   * Find staff by phone number (global search across all campuses)
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Staff | null>;

  /**
   * Find staff by phone number within a specific campus (campus-scoped uniqueness)
   */
  abstract findByPhoneNumberInCampus(
    campusId: string,
    phoneNumber: string,
  ): Promise<Staff | null>;

  /**
   * Find staff by user ID
   */
  abstract findByUserId(userId: string): Promise<Staff | null>;

  /**
   * Find staff by staff type ID
   */
  abstract findByStaffTypeId(staffTypeId: string): Promise<Staff[]>;

  /**
   * Find staff by campus ID
   */
  abstract findByCampusId(campusId: string): Promise<Staff[]>;

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
