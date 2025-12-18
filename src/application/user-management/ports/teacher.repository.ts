/**
 * Teacher Repository Port (Interface)
 * Defines the contract for teacher data access
 * Implementation will be provided by infrastructure layer
 */

import { Teacher } from "@/domain/user-management/entities/teacher.entity";
import { TeacherType } from "@/domain/user-management/enums/teacher-type.enum";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class TeacherRepository {
  /**
   * Find teacher by ID
   */
  abstract findById(id: string): Promise<Teacher | null>;

  /**
   * Find teacher by email
   */
  abstract findByEmail(email: string): Promise<Teacher | null>;

  /**
   * Find teacher by phone number
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Teacher | null>;

  /**
   * Find teacher by user ID
   */
  abstract findByUserId(userId: string): Promise<Teacher | null>;

  /**
   * Find teachers by type
   */
  abstract findByType(type: TeacherType): Promise<Teacher[]>;

  /**
   * Find multiple teachers by IDs
   */
  abstract findByIds(ids: string[]): Promise<Teacher[]>;

  /**
   * Find all teachers with filtering, sorting, pagination using StandardRequest
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Teacher>>;

  /**
   * Save a new teacher
   */
  abstract save(teacher: Teacher): Promise<Teacher>;

  /**
   * Update existing teacher
   */
  abstract update(teacher: Teacher): Promise<Teacher>;

  /**
   * Delete teacher
   */
  abstract delete(id: string): Promise<void>;
}
