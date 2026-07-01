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

  // RBAC role lifecycle (3)
  "CREATE_ROLE",
  "UPDATE_ROLE",
  "DELETE_ROLE",

  // StaffType lifecycle (4)
  "CREATE_STAFF_TYPE",
  "UPDATE_STAFF_TYPE",
  "ARCHIVE_STAFF_TYPE",
  "REORDER_STAFF_TYPES",

  // Meal-menu lifecycle (6)
  "CREATE_MEAL_MENU",
  "COPY_MEAL_MENU",
  "UPDATE_MEAL_MENU",
  "ARCHIVE_MEAL_MENU",
  "RESTORE_MEAL_MENU",
  "UPDATE_MEAL_MENU_CONFIG",

  // Weekly-plan lifecycle (5)
  "CREATE_WEEKLY_PLAN",
  "COPY_WEEKLY_PLAN",
  "UPDATE_WEEKLY_PLAN",
  "ARCHIVE_WEEKLY_PLAN",
  "RESTORE_WEEKLY_PLAN",

  // Student health lifecycle (7)
  "UPDATE_STUDENT_HEALTH_PROFILE",
  "CREATE_STUDENT_HEALTH_CHECKUP",
  "UPDATE_STUDENT_HEALTH_CHECKUP",
  "CREATE_STUDENT_HEALTH_INSTRUCTION",
  "UPDATE_STUDENT_HEALTH_INSTRUCTION",
  "CREATE_STUDENT_HEALTH_EVENT",
  "UPDATE_STUDENT_HEALTH_EVENT",

  // Medication lifecycle (1)
  "CREATE_MEDICATION_REQUEST",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
