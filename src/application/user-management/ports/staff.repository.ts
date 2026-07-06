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
   * Find any staff profile by linked user ID within a campus, including
   * archived profiles. Used by create-or-attach flows to distinguish active,
   * archived, and absent target-campus profiles for a shared identity.
   */
  abstract findAnyByUserIdInCampus(
    userId: string,
    campusId: string,
  ): Promise<Staff | null>;

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
   * @param params - Standard query parameters (filters, sorts, pagination)
   * @param scope - Optional system-enforced filters (e.g., campusId) that bypass allowedFilterFields
   */
  abstract findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Staff>>;

  /**
   * Find staff eligible to be assigned to the given class.
   *
   * A staff member is "eligible" iff:
   *   - staff.isArchived = false
   *   - staff is at `scope.campusId` (system-enforced; cannot be overridden)
   *   - NOT EXISTS any classStaff row for this staff in the target class
   *     (excludes already-assigned staff regardless of their existing role)
   *
   * Pagination, sort, and search go through the standard PrismaQueryService
   * path so list-endpoint semantics stay consistent with `findAll`.
   *
   * See @doc/specs/bulk-class-staff-assignment FR-6..FR-8, D4, D9.
   *
   * @param classId - The target class id; staff already assigned to this
   *   class are excluded via an anti-join on `classStaff`.
   * @param params - Standard query parameters (filters, sorts, pagination).
   *   Caller surface is limited to `fullName` (ilike for `?search=...`).
   * @param scope - System-enforced filters; `campusId` is required for campus
   *   isolation. Caller derives it from `class.campusId` after a cross-campus
   *   404 check (D9).
   */
  abstract findEligibleForClass(
    classId: string,
    params: StandardRequest,
    scope?: { campusId: string },
  ): Promise<PaginatedResult<Staff>>;

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
