import { Prisma } from "@prisma/client";

import { AuditAction } from "@/domain/audit";

/**
 * Transaction-client alias for the audit recorder.
 *
 * The recorder MUST insert its row in the *same* Prisma transaction as the
 * underlying mutation (D4 of `@doc/specs/admin-audit-log`). Use cases pass
 * their active `tx` into `record()` — there is no internal `$transaction`
 * call here, by design. Aliasing the Prisma type at the port boundary
 * contains the dependency to one import without forcing the application
 * layer to invent a parallel transaction abstraction.
 */
export type AuditTransactionClient = Prisma.TransactionClient;

/**
 * Discriminator for the audited entity. Free-form `string` in the DB column
 * (FR-2) so new types can be added without schema migration; the recorder
 * adapter validates the current vocabulary at runtime.
 *
 * `"user"` covers RBAC role grants (`GRANT_ROLE` / `REVOKE_ROLE` from
 * @doc/specs/direct-role-assignment-via-uow D1) — the target is the `User`
 * row receiving or losing the role-campus pair.
 */
export type AuditTargetType =
  | "student"
  | "guardian"
  | "staff"
  | "staff_type"
  | "user"
  | "role"
  | "meal_menu"
  | "meal_menu_config"
  | "post"
  | "post_category"
  | "campus_setting"
  | "post_history_status"
  | "post_approval_request"
  | "weekly_plan"
  | "student_health_profile"
  | "student_health_checkup"
  | "student_health_instruction"
  | "student_health_event"
  | "medication_request";

/**
 * Input payload for a single audit-event write.
 *
 * The caller supplies:
 *   - identity refs (`actorId`, `targetId`, `campusId`) — all NOT NULL in the DB
 *   - the action code (`AuditAction` is the curated vocabulary)
 *   - `context` jsonb — domain-specific snapshots the caller already has
 *     loaded (e.g. `fromClassName`, `toClassName`, `transferDate`). Required
 *     name snapshots like `actorName` should be added here too: the recorder
 *     does not auto-resolve `actorName` because the `User` aggregate has no
 *     name field — it lives on the linked Guardian / Staff profile.
 *   - `beforeValue` / `afterValue` — only the changed-field diff/snapshot for
 *     update-like actions. Null otherwise.
 *
 * The recorder enriches `context` with a `targetName` snapshot resolved from
 * the supplied `tx` (Technical Notes — Snapshot resolution). Caller-provided
 * keys win on collision, so a caller that already has the target name in
 * hand can short-circuit the lookup by setting `context.targetName`.
 */
export interface AuditEventInput {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  campusId: string;
  context: Record<string, unknown>;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
}

/**
 * AuditEventRecorderPort
 *
 * Application-layer seam for emitting audit events. Bound to
 * `PrismaAuditEventRecorder` in `PrismaModule` so every feature module that
 * already imports `PrismaModule` can inject the port without re-wiring.
 *
 * Abstract class (not interface) for DI binding — matches the pattern used
 * by `UnitOfWorkPort` and other non-repository ports
 * (`@doc/patterns/module-pattern`).
 */
export abstract class AuditEventRecorderPort {
  /**
   * Insert one audit row inside the caller's existing transaction.
   *
   * Atomicity guarantee (D4): if this method throws, the surrounding
   * `$transaction` rolls back — including the mutation that triggered it.
   * The recorder MUST NOT swallow errors.
   */
  abstract record(
    input: AuditEventInput,
    tx: AuditTransactionClient,
  ): Promise<void>;
}
