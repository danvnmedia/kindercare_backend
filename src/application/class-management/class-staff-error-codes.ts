/**
 * Class-staff error codes.
 *
 * Spec: @doc/specs/subject-removal-classstaff-role-refactor (Locked Decision D5
 * — single HOMEROOM per class enforced at domain layer; partial unique index
 * is the DB backstop).
 *
 * Consumed by the three class-staff mutation use cases:
 *   - AssignStaffToClassUseCase  → HOMEROOM_ALREADY_ASSIGNED, STAFF_ALREADY_ASSIGNED
 *   - RemoveStaffFromClassUseCase → STAFF_NOT_FOUND_IN_CLASS
 *   - ChangeClassStaffRoleUseCase → HOMEROOM_ALREADY_ASSIGNED, STAFF_NOT_FOUND_IN_CLASS
 */
export const ClassStaffErrorCode = {
  HOMEROOM_ALREADY_ASSIGNED: "HOMEROOM_ALREADY_ASSIGNED",
  STAFF_ALREADY_ASSIGNED: "STAFF_ALREADY_ASSIGNED",
  STAFF_NOT_FOUND_IN_CLASS: "STAFF_NOT_FOUND_IN_CLASS",
} as const;

export type ClassStaffErrorCode =
  (typeof ClassStaffErrorCode)[keyof typeof ClassStaffErrorCode];
