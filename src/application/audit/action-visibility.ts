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

  // Creation (3)
  CREATE_STUDENT: "ADMIN",
  CREATE_GUARDIAN: "ADMIN",
  CREATE_STAFF: "ADMIN",

  // Guardian ↔ Student (2)
  LINK_GUARDIAN_TO_STUDENT: "ADMIN",
  UNLINK_GUARDIAN_FROM_STUDENT: "ADMIN",

  // Class-staff lifecycle (3)
  ASSIGN_STAFF_TO_CLASS: "ADMIN",
  REMOVE_STAFF_FROM_CLASS: "ADMIN",
  CHANGE_STAFF_ROLE: "ADMIN",
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
