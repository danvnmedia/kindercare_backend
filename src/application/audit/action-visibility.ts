import { AUDIT_ACTIONS, AuditAction, AuditVisibility } from "@/domain/audit";

/**
 * ACTION_VISIBILITY — per-action visibility default for audit rows.
 *
 * Source of truth: @doc/specs/admin-audit-log Locked Decision D5.
 *
 * Every entry defaults to `'ADMIN'` in v1. Flipping any single action to
 * `'GUARDIAN_VISIBLE'` later is a one-line change here — no schema
 * migration, no backfill, no API contract change. The recorder reads from
 * this map at write time so newly inserted rows pick up the new value
 * immediately while historical rows keep the value they were written with.
 *
 * Exhaustiveness: typed as `Record<AuditAction, AuditVisibility>` so a new
 * `AuditAction` member added in @doc/specs/admin-audit-log FR-1 forces a
 * companion entry here at compile time (TS error otherwise). The companion
 * unit test asserts runtime coverage of every `AUDIT_ACTIONS` value.
 */
export const ACTION_VISIBILITY: Record<AuditAction, AuditVisibility> = {
  // Enrollment lifecycle (5)
  ENROLL_STUDENT_TO_CLASS: "ADMIN",
  TRANSFER_STUDENT: "ADMIN",
  WITHDRAW_FROM_CLASS: "ADMIN",
  REGISTER_FOR_SCHOOL_YEAR: "ADMIN",
  WITHDRAW_FROM_SCHOOL_YEAR: "ADMIN",

  // Profile edits (3)
  EDIT_STUDENT_PROFILE: "ADMIN",
  EDIT_GUARDIAN_PROFILE: "ADMIN",
  EDIT_STAFF_PROFILE: "ADMIN",

  // Archive / restore (6)
  ARCHIVE_STUDENT: "ADMIN",
  RESTORE_STUDENT: "ADMIN",
  ARCHIVE_GUARDIAN: "ADMIN",
  RESTORE_GUARDIAN: "ADMIN",
  ARCHIVE_STAFF: "ADMIN",
  RESTORE_STAFF: "ADMIN",

  // Creation / attach (5)
  CREATE_STUDENT: "ADMIN",
  CREATE_GUARDIAN: "ADMIN",
  CREATE_STAFF: "ADMIN",
  ATTACH_EXISTING_GUARDIAN_IDENTITY: "ADMIN",
  ATTACH_EXISTING_STAFF_IDENTITY: "ADMIN",

  // Guardian ↔ Student (2)
  LINK_GUARDIAN_TO_STUDENT: "ADMIN",
  UNLINK_GUARDIAN_FROM_STUDENT: "ADMIN",

  // Class-staff lifecycle (3)
  ASSIGN_STAFF_TO_CLASS: "ADMIN",
  REMOVE_STAFF_FROM_CLASS: "ADMIN",
  CHANGE_STAFF_ROLE: "ADMIN",

  // RBAC role grants (2)
  GRANT_ROLE: "ADMIN",
  REVOKE_ROLE: "ADMIN",

  // RBAC role lifecycle (3)
  CREATE_ROLE: "ADMIN",
  UPDATE_ROLE: "ADMIN",
  DELETE_ROLE: "ADMIN",

  // Global identity lifecycle (3)
  LOCK_GLOBAL_IDENTITY: "ADMIN",
  UNLOCK_GLOBAL_IDENTITY: "ADMIN",
  DELETE_GLOBAL_IDENTITY: "ADMIN",

  // StaffType lifecycle (4)
  CREATE_STAFF_TYPE: "ADMIN",
  UPDATE_STAFF_TYPE: "ADMIN",
  ARCHIVE_STAFF_TYPE: "ADMIN",
  REORDER_STAFF_TYPES: "ADMIN",

  // Meal-menu lifecycle (6)
  CREATE_MEAL_MENU: "ADMIN",
  COPY_MEAL_MENU: "ADMIN",
  UPDATE_MEAL_MENU: "ADMIN",
  ARCHIVE_MEAL_MENU: "ADMIN",
  RESTORE_MEAL_MENU: "ADMIN",
  UPDATE_MEAL_MENU_CONFIG: "ADMIN",

  // Weekly-plan lifecycle (5)
  CREATE_WEEKLY_PLAN: "ADMIN",
  COPY_WEEKLY_PLAN: "ADMIN",
  UPDATE_WEEKLY_PLAN: "ADMIN",
  ARCHIVE_WEEKLY_PLAN: "ADMIN",
  RESTORE_WEEKLY_PLAN: "ADMIN",

  // Student health lifecycle (7)
  UPDATE_STUDENT_HEALTH_PROFILE: "ADMIN",
  CREATE_STUDENT_HEALTH_CHECKUP: "ADMIN",
  UPDATE_STUDENT_HEALTH_CHECKUP: "ADMIN",
  CREATE_STUDENT_HEALTH_INSTRUCTION: "ADMIN",
  UPDATE_STUDENT_HEALTH_INSTRUCTION: "ADMIN",
  CREATE_STUDENT_HEALTH_EVENT: "ADMIN",
  UPDATE_STUDENT_HEALTH_EVENT: "ADMIN",

  // Medication lifecycle (1)
  CREATE_MEDICATION_REQUEST: "ADMIN",
};

// Runtime self-check — keeps the map covering every AuditAction even if the
// type-system check is bypassed (e.g. by intentional `as` casts elsewhere).
// Throws at module load (and thus at app boot) if drift is introduced.
if (Object.keys(ACTION_VISIBILITY).length !== AUDIT_ACTIONS.length) {
  throw new Error(
    `ACTION_VISIBILITY drift: expected ${AUDIT_ACTIONS.length} entries, got ${
      Object.keys(ACTION_VISIBILITY).length
    }`,
  );
}
