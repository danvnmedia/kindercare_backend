/**
 * Class Repository Port (Interface)
 * Defines the contract for class data access
 * Implementation will be provided by infrastructure layer
 */

import { Class } from "@/domain/class-management/entities/class.entity";
import { GradeLevel } from "@/domain/class-management/entities/grade-level.entity";
import { SchoolYear } from "@/domain/class-management/entities/school-year.entity";
import { ClassStaffRole } from "@/domain/class-management/enums/class-staff-role.enum";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

/**
 * Flat read-side projection returned by `ClassRepository.findAll` so the
 * `GET /classes` list endpoint can render student counts and staff previews
 * without polluting the `Class` aggregate with derived fields.
 *
 * Mirrors the layout of `ClassListItemResponse` so the
 * `StandardResponseInterceptor` `plainToInstance` step can apply
 * `@Expose()` directly to top-level fields. Embedded `gradeLevel` and
 * `schoolYear` remain domain entities so they flatten correctly through the
 * interceptor's Entity-shape path (same flow as the existing `ClassResponse`).
 */
export class ClassDeletionConflictError extends Error {
  constructor() {
    super("Class cannot be deleted while it is referenced by existing records");
    this.name = ClassDeletionConflictError.name;
  }
}

export interface ClassListItemView {
  id: string;
  name: string;
  description: string | null;
  campusId: string;
  gradeLevelId: string;
  schoolYearId: string;
  gradeLevel: GradeLevel | null;
  schoolYear: SchoolYear | null;
  activeStudentCount: number;
  upcomingStudentCount: number;
  historicalStudentCount: number;
  staff: Array<{ id: string; fullName: string; role: ClassStaffRole }>;
  createdAt: Date;
  updatedAt: Date;
}

export abstract class ClassRepository {
  /**
   * Find class by ID
   */
  abstract findById(id: string): Promise<Class | null>;

  /**
   * Find class by name within a campus, school year, and grade level
   * Used for uniqueness check: (campus_id, school_year_id, grade_level_id, name)
   */
  abstract findByNameInContextAndCampus(
    name: string,
    campusId: string,
    schoolYearId: string,
    gradeLevelId: string,
  ): Promise<Class | null>;

  /**
   * Find classes by campus
   */
  abstract findByCampusId(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<Class>>;

  /**
   * Find classes by grade level (within a campus)
   */
  abstract findByGradeLevelId(
    gradeLevelId: string,
    campusId: string,
  ): Promise<Class[]>;

  /**
   * Find classes by school year (within a campus)
   */
  abstract findBySchoolYearId(
    schoolYearId: string,
    campusId: string,
  ): Promise<Class[]>;

  /**
   * Find multiple classes by IDs
   */
  abstract findByIds(ids: string[]): Promise<Class[]>;

  /**
   * Find all classes with filtering, sorting, pagination using StandardRequest.
   * Each row carries the active enrollment count and a compact staff preview
   * for the `GET /classes` list endpoint.
   * @param campusId - Campus ID to filter by
   * @param params - Standard request with pagination, filtering, sorting
   */
  abstract findAll(
    campusId: string,
    params: StandardRequest,
    referenceDate: Date,
  ): Promise<PaginatedResult<ClassListItemView>>;

  /**
   * Save a new class
   */
  abstract save(classEntity: Class): Promise<Class>;

  /**
   * Update existing class
   */
  abstract update(classEntity: Class): Promise<Class>;

  /**
   * Delete class
   */
  abstract delete(id: string): Promise<void>;
}
