/**
 * ClassStaff Repository Port (Interface)
 * Defines the contract for class-staff assignment data access.
 * Implementation is provided by the infrastructure layer.
 */

import { ClassStaff } from "@/domain/class-management/entities/class-staff.entity";

export abstract class ClassStaffRepository {
  /**
   * Find a single assignment by its natural key (classId, staffId).
   * Returns null if no assignment exists for that pair.
   */
  abstract findByPair(
    classId: string,
    staffId: string,
  ): Promise<ClassStaff | null>;

  /**
   * Find the HOMEROOM assignment for a class, if one exists.
   * Used by the application layer to enforce single-HOMEROOM-per-class
   * before issuing a write (the DB partial unique index is the backstop).
   */
  abstract findHomeroomByClassId(classId: string): Promise<ClassStaff | null>;

  /**
   * Find all assignments for a class.
   */
  abstract findByClassId(classId: string): Promise<ClassStaff[]>;

  /**
   * Find all assignments for a staff member.
   */
  abstract findByStaffId(staffId: string): Promise<ClassStaff[]>;

  /**
   * Persist a new assignment.
   */
  abstract save(classStaff: ClassStaff): Promise<ClassStaff>;

  /**
   * Persist a role change (or any other mutable field).
   * Identity (classId, staffId) is immutable and not updated.
   */
  abstract update(classStaff: ClassStaff): Promise<ClassStaff>;

  /**
   * Delete the assignment identified by (classId, staffId).
   */
  abstract delete(classId: string, staffId: string): Promise<void>;

  /**
   * Delete all assignments for a class (cascade helper).
   */
  abstract deleteByClassId(classId: string): Promise<void>;

  /**
   * Delete all assignments for a staff member (cascade helper).
   */
  abstract deleteByStaffId(staffId: string): Promise<void>;
}
