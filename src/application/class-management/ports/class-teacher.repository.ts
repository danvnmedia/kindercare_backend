/**
 * ClassTeacher Repository Port (Interface)
 * Defines the contract for class-teacher assignment data access
 * Implementation will be provided by infrastructure layer
 */

import { ClassTeacher } from "@/domain/class-management/entities/class-teacher.entity";

export abstract class ClassTeacherRepository {
  /**
   * Find assignment by composite key
   */
  abstract findByCompositeKey(
    classId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<ClassTeacher | null>;

  /**
   * Find all assignments for a class
   */
  abstract findByClassId(classId: string): Promise<ClassTeacher[]>;

  /**
   * Find all assignments for a teacher
   */
  abstract findByTeacherId(teacherId: string): Promise<ClassTeacher[]>;

  /**
   * Find all assignments for a subject
   */
  abstract findBySubjectId(subjectId: string): Promise<ClassTeacher[]>;

  /**
   * Find assignments by class and subject
   */
  abstract findByClassAndSubject(
    classId: string,
    subjectId: string,
  ): Promise<ClassTeacher[]>;

  /**
   * Save a new assignment
   */
  abstract save(classTeacher: ClassTeacher): Promise<ClassTeacher>;

  /**
   * Delete assignment by composite key
   */
  abstract delete(
    classId: string,
    teacherId: string,
    subjectId: string,
  ): Promise<void>;

  /**
   * Delete all assignments for a class
   */
  abstract deleteByClassId(classId: string): Promise<void>;

  /**
   * Delete all assignments for a teacher
   */
  abstract deleteByTeacherId(teacherId: string): Promise<void>;
}
