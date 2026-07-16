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
  // Enrollment, school-year lifecycle, and historical record lifecycle
  "ENROLL_STUDENT_TO_CLASS",
  "TRANSFER_STUDENT",
  "WITHDRAW_FROM_CLASS",
  "REGISTER_FOR_SCHOOL_YEAR",
  "WITHDRAW_FROM_SCHOOL_YEAR",
  "CANCEL_SCHOOL_YEAR_ENROLLMENT",
  "CORRECT_SCHOOL_YEAR_ENROLLMENT_GRADE",
  "CREATE_SCHOOL_YEAR_LIFECYCLE_RUN",
  "UPDATE_SCHOOL_YEAR_LIFECYCLE_SETUP",
  "CANCEL_SCHOOL_YEAR_LIFECYCLE_RUN",
  "EXPIRE_SCHOOL_YEAR_LIFECYCLE_RUN",
  "REFRESH_SCHOOL_YEAR_LIFECYCLE_CANDIDATES",
  "SAVE_SCHOOL_YEAR_LIFECYCLE_DECISIONS",
  "PREVIEW_SCHOOL_YEAR_LIFECYCLE",
  "COMMIT_SCHOOL_YEAR_LIFECYCLE",
  "COMMIT_SCHOOL_YEAR_LIFECYCLE_ROW",
  "CORRECT_HISTORICAL_RECORD",
  "EXPORT_HISTORICAL_RECORD",
  "ARCHIVE_HISTORICAL_RECORD",
  "REDACT_HISTORICAL_RECORD",
  "DELETE_HISTORICAL_RECORD",
  "BLOCK_STUDENT_HARD_DELETE_FOR_RETENTION",

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

  // Creation / attach (5)
  "CREATE_STUDENT",
  "CREATE_GUARDIAN",
  "CREATE_STAFF",
  "ATTACH_EXISTING_GUARDIAN_IDENTITY",
  "ATTACH_EXISTING_STAFF_IDENTITY",

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

  // Global identity lifecycle (3)
  "LOCK_GLOBAL_IDENTITY",
  "UNLOCK_GLOBAL_IDENTITY",
  "DELETE_GLOBAL_IDENTITY",

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

  // CMS lifecycle (15)
  "CREATE_POST",
  "UPDATE_POST",
  "DELETE_POST",
  "SUBMIT_POST_FOR_REVIEW",
  "APPROVE_POST",
  "REJECT_POST",
  "PUBLISH_POST",
  "ARCHIVE_POST",
  "PIN_POST",
  "UNPIN_POST",
  "CREATE_POST_CATEGORY",
  "UPDATE_POST_CATEGORY",
  "DELETE_POST_CATEGORY",
  "REORDER_POST_CATEGORIES",
  "UPDATE_CAMPUS_SETTING",

  // Weekly-plan lifecycle (5)
  "CREATE_WEEKLY_PLAN",
  "COPY_WEEKLY_PLAN",
  "UPDATE_WEEKLY_PLAN",
  "ARCHIVE_WEEKLY_PLAN",
  "RESTORE_WEEKLY_PLAN",

  // Student health lifecycle (10)
  "UPDATE_STUDENT_HEALTH_PROFILE",
  "CREATE_STUDENT_HEALTH_CHECKUP",
  "UPDATE_STUDENT_HEALTH_CHECKUP",
  "ARCHIVE_STUDENT_HEALTH_CHECKUP",
  "CREATE_STUDENT_HEALTH_INSTRUCTION",
  "UPDATE_STUDENT_HEALTH_INSTRUCTION",
  "ARCHIVE_STUDENT_HEALTH_INSTRUCTION",
  "CREATE_STUDENT_HEALTH_EVENT",
  "UPDATE_STUDENT_HEALTH_EVENT",
  "ARCHIVE_STUDENT_HEALTH_EVENT",

  // Medication lifecycle (1)
  "CREATE_MEDICATION_REQUEST",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
