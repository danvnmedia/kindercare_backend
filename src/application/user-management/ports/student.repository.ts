/**
 * Student Repository Port (Interface)
 * Defines the contract for student data access
 * Implementation will be provided by infrastructure layer
 */

import { Student } from "@/domain/user-management/entities/student.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StudentRepository {
  /**
   * Find student by ID
   */
  abstract findById(id: string): Promise<Student | null>;

  /**
   * Find student by email
   */
  abstract findByEmail(email: string): Promise<Student | null>;

  /**
   * Find student by phone number
   */
  abstract findByPhoneNumber(phoneNumber: string): Promise<Student | null>;

  /**
   * Find multiple students by IDs
   */
  abstract findByIds(ids: string[]): Promise<Student[]>;

  /**
   * Find all students with filtering, sorting, pagination using StandardRequest
   */
  abstract findAll(params: StandardRequest): Promise<PaginatedResult<Student>>;

  /**
   * Save a new or existing student
   */
  abstract save(student: Student): Promise<Student>;

  /**
   * Update existing student
   */
  abstract update(student: Student): Promise<Student>;

  /**
   * Delete student
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Assign guardians to student
   * @param studentId - Student ID
   * @param guardianRelations - Array of { guardianId, relationshipId }
   */
  abstract assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void>;

  /**
   * Remove guardians from student
   */
  abstract removeGuardians(
    studentId: string,
    guardianIds: string[],
  ): Promise<void>;

  /**
   * Get student guardians
   */
  abstract getStudentGuardians(studentId: string): Promise<any[]>;
}
