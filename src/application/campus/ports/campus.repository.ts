/**
 * Campus Repository Port (Interface)
 * Defines the contract for campus data access
 * Implementation will be provided by infrastructure layer
 */

import { Campus } from "@/domain/campus/entities/campus.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class CampusRepository {
  /**
   * Find campus by ID
   */
  abstract findById(id: string): Promise<Campus | null>;

  /**
   * Find campus by name
   */
  abstract findByName(name: string): Promise<Campus | null>;

  /**
   * Find all campuses with pagination, filtering, and sorting
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Campus>>;

  /**
   * Save a new campus
   */
  abstract save(campus: Campus): Promise<Campus>;

  /**
   * Update existing campus
   */
  abstract update(campus: Campus): Promise<Campus>;

  /**
   * Delete campus by ID
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Check if campus exists by ID
   */
  abstract exists(id: string): Promise<boolean>;
}
