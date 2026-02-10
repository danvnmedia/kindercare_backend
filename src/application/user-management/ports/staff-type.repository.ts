/**
 * StaffType Repository Port (Interface)
 * Defines the contract for staff type data access
 * Implementation will be provided by infrastructure layer
 */

import { StaffType } from "@/domain/user-management/entities/staff-type.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StaffTypeRepository {
  /**
   * Find staff type by ID
   */
  abstract findById(id: string): Promise<StaffType | null>;

  /**
   * Find staff type by name within a campus (name unique per campus)
   */
  abstract findByName(
    campusId: string,
    name: string,
  ): Promise<StaffType | null>;

  /**
   * Find staff type by order within a campus (order unique per campus)
   */
  abstract findByOrderAndCampus(
    order: number,
    campusId: string,
  ): Promise<StaffType | null>;

  /**
   * Find all staff types for a campus
   */
  abstract findByCampusId(campusId: string): Promise<StaffType[]>;

  /**
   * Find all staff types with pagination, filtering, and sorting
   */
  abstract findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<StaffType>>;

  /**
   * Save a new staff type
   */
  abstract save(staffType: StaffType): Promise<StaffType>;

  /**
   * Update existing staff type
   */
  abstract update(staffType: StaffType): Promise<StaffType>;

  /**
   * Delete staff type by ID
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Check if staff type exists by ID
   */
  abstract exists(id: string): Promise<boolean>;

  /**
   * Check if staff type exists and is active
   */
  abstract existsAndActive(id: string): Promise<boolean>;

  /**
   * Get the maximum order value for staff types in a campus
   */
  abstract getMaxOrder(campusId: string): Promise<number>;

  /**
   * Reorder staff types within a campus
   * Uses two-phase transaction to avoid unique constraint violations
   */
  abstract reorder(campusId: string, ids: string[]): Promise<StaffType[]>;
}
