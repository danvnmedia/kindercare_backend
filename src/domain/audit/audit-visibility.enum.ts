/**
 * AuditVisibility — string-union of the audit-event visibility levels.
 *
 * Source of truth: @doc/specs/admin-audit-log Locked Decision D5.
 *
 * Modelled as a `const` tuple + literal-union (mirrors `audit-action.enum.ts`)
 * so the per-action `ACTION_VISIBILITY` map in the application layer can be
 * exhaustively typed as `Record<AuditAction, AuditVisibility>`.
 *
 * v1 inserts always use `'ADMIN'`. The schema column exists so individual
 * actions can be flipped to `'GUARDIAN_VISIBLE'` later by changing only the
 * constant — no DB migration required (D5).
 */
export const AUDIT_VISIBILITIES = ["ADMIN", "GUARDIAN_VISIBLE"] as const;

export type AuditVisibility = (typeof AUDIT_VISIBILITIES)[number];
