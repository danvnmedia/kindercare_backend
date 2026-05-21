/**
 * AuditAction — string-union of the 19 v1 audit action codes.
 *
 * Source of truth: @doc/specs/admin-audit-log FR-1.
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
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
