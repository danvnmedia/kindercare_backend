/**
 * Class-staff error codes.
 *
 * Specs:
 *   - @doc/specs/subject-removal-classstaff-role-refactor (D5 — single HOMEROOM
 *     per class enforced at domain layer; partial unique index is the DB backstop).
 *   - @doc/specs/bulk-class-staff-assignment (D8 — bulk-only codes are added to
 *     this existing module rather than a separate bulk-specific file).
 *
 * Consumed by the class-staff mutation use cases:
 *   - AssignStaffToClassUseCase     → HOMEROOM_ALREADY_ASSIGNED, STAFF_ALREADY_ASSIGNED
 *   - RemoveStaffFromClassUseCase   → STAFF_NOT_FOUND_IN_CLASS
 *   - ChangeClassStaffRoleUseCase   → HOMEROOM_ALREADY_ASSIGNED, STAFF_NOT_FOUND_IN_CLASS
 *   - BulkAssignStaffToClassUseCase → BATCH_EMPTY, BATCH_TOO_LARGE,
 *                                     DUPLICATE_STAFF_IN_BATCH, MULTIPLE_HOMEROOM_IN_BATCH,
 *                                     STAFF_NOT_FOUND, STAFF_NOT_IN_CAMPUS
 */
export const ClassStaffErrorCode = {
  HOMEROOM_ALREADY_ASSIGNED: "HOMEROOM_ALREADY_ASSIGNED",
  STAFF_ALREADY_ASSIGNED: "STAFF_ALREADY_ASSIGNED",
  STAFF_NOT_FOUND_IN_CLASS: "STAFF_NOT_FOUND_IN_CLASS",
  BATCH_EMPTY: "BATCH_EMPTY",
  BATCH_TOO_LARGE: "BATCH_TOO_LARGE",
  DUPLICATE_STAFF_IN_BATCH: "DUPLICATE_STAFF_IN_BATCH",
  MULTIPLE_HOMEROOM_IN_BATCH: "MULTIPLE_HOMEROOM_IN_BATCH",
  STAFF_NOT_FOUND: "STAFF_NOT_FOUND",
  STAFF_NOT_IN_CAMPUS: "STAFF_NOT_IN_CAMPUS",
} as const;

export type ClassStaffErrorCode =
  (typeof ClassStaffErrorCode)[keyof typeof ClassStaffErrorCode];
