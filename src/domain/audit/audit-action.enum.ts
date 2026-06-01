/**
 * AuditAction — string-union of the v1 audit action codes.
 *
 * Source of truth: @doc/specs/admin-audit-log FR-1 plus feature-specific
 * audit extensions documented in their specs.
 *
 * Modelled as a `const` tuple + literal-union (not a TS `enum`) because the
 * FE action-list export needs to iterate the values at runtime (@task-9cx0ob),
 * and the AuditEventRecorder service (@task-9cpd5c) types its input as the
 * literal union for compile-time exhaustiveness.
 *
 * Adding a new action requires updating this tuple AND the per-action context
 * shape in @doc/references/audit-event-context-shapes.
 */
export const AUDIT_ACTIONS = [
  // Enrollment lifecycle (5)
  "ENROLL_STUDENT_TO_CLASS",
  "TRANSFER_STUDENT",
  "WITHDRAW_FROM_CLASS",
  "REGISTER_FOR_SCHOOL_YEAR",
  "WITHDRAW_FROM_SCHOOL_YEAR",

  // Profile edits (3)
  "EDIT_STUDENT_PROFILE",
  "EDIT_GUARDIAN_PROFILE",
  "EDIT_STAFF_PROFILE",

  // Archive / restore (6)
  "ARCHIVE_STUDENT",
  "RESTORE_STUDENT",
  "ARCHIVE_GUARDIAN",
  "RESTORE_GUARDIAN",
  "ARCHIVE_STAFF",
  "RESTORE_STAFF",

  // Creation (3)
  "CREATE_STUDENT",
  "CREATE_GUARDIAN",
  "CREATE_STAFF",

  // Guardian ↔ Student (2)
  "LINK_GUARDIAN_TO_STUDENT",
  "UNLINK_GUARDIAN_FROM_STUDENT",

  // Class-staff lifecycle (3)
  "ASSIGN_STAFF_TO_CLASS",
  "REMOVE_STAFF_FROM_CLASS",
  "CHANGE_STAFF_ROLE",

  // RBAC role grants (2)
  "GRANT_ROLE",
  "REVOKE_ROLE",

  // Meal-menu lifecycle (6)
  "CREATE_MEAL_MENU",
  "COPY_MEAL_MENU",
  "UPDATE_MEAL_MENU",
  "ARCHIVE_MEAL_MENU",
  "RESTORE_MEAL_MENU",
  "UPDATE_MEAL_MENU_CONFIG",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
