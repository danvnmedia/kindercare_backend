/**
 * ClassStaff Repository Port (Interface)
 * Defines the contract for class-staff assignment data access
 * Implementation will be provided by infrastructure layer
 */

import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";

export abstract class ClassStaffRepository {
  /**
   * Find assignment by composite key
   */
  abstract findByCompositeKey(
    classId: string,
    staffId: string,
    subjectId: string,
  ): Promise<ClassStaff | null>;

  /**
   * Find all assignments for a class
   */
  abstract findByClassId(classId: string): Promise<ClassStaff[]>;

  /**
   * Find all assignments for a staff
   */
  abstract findByStaffId(staffId: string): Promise<ClassStaff[]>;

  /**
   * Find all assignments for a subject
   */
  abstract findBySubjectId(subjectId: string): Promise<ClassStaff[]>;

  /**
   * Find assignments by class and subject
   */
  abstract findByClassAndSubject(
    classId: string,
    subjectId: string,
  ): Promise<ClassStaff[]>;

  /**
   * Save a new assignment
   */
  abstract save(classStaff: ClassStaff): Promise<ClassStaff>;

  /**
   * Delete assignment by composite key
   */
  abstract delete(
    classId: string,
    staffId: string,
    subjectId: string,
  ): Promise<void>;

  /**
   * Delete all assignments for a class
   */
  abstract deleteByClassId(classId: string): Promise<void>;

  /**
   * Delete all assignments for a staff
   */
  abstract deleteByStaffId(staffId: string): Promise<void>;
}
