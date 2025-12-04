/**
 * Student Repository Port (Interface)
 * Defines the contract for student data access
 * Implementation will be provided by infrastructure layer
 */

import { Student } from '../../../domain/user-management/student.entity';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';
import { PaginatedResult } from '@/core/modules/standard-response/dto/query.dto';

export interface StudentRepository {
  /**
   * Find student by ID
   */
  findById(id: string): Promise<Student | null>;

  /**
   * Find student by email
   */
  findByEmail(email: string): Promise<Student | null>;

  /**
   * Find student by phone number
   */
  findByPhoneNumber(phoneNumber: string): Promise<Student | null>;

  /**
   * Find multiple students by IDs
   */
  findByIds(ids: string[]): Promise<Student[]>;

  /**
   * Find all students with filtering, sorting, pagination using StandardRequest
   */
  findAll(params: StandardRequest): Promise<PaginatedResult<Student>>;

  /**
   * Save a new student
   */
  save(student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student>;

  /**
   * Update existing student
   */
  update(id: string, data: Partial<Student>): Promise<Student>;

  /**
   * Delete student
   */
  delete(id: string): Promise<void>;

  /**
   * Assign guardians to student
   * @param studentId - Student ID
   * @param guardianRelations - Array of { guardianId, relationshipId }
   */
  assignGuardians(
    studentId: string,
    guardianRelations: Array<{ guardianId: string; relationshipId: string }>,
  ): Promise<void>;

  /**
   * Remove guardians from student
   */
  removeGuardians(studentId: string, guardianIds: string[]): Promise<void>;

  /**
   * Get student guardians
   */
  getStudentGuardians(studentId: string): Promise<any[]>;
}
