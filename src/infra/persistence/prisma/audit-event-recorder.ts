import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { ACTION_VISIBILITY } from "@/application/audit/action-visibility";
import {
  AuditEventInput,
  AuditEventRecorderPort,
  AuditTargetType,
  AuditTransactionClient,
} from "@/application/audit/ports/audit-event-recorder.port";

/**
 * PrismaAuditEventRecorder — infra adapter for `AuditEventRecorderPort`.
 *
 * Operates entirely on the supplied `tx: Prisma.TransactionClient`. The
 * adapter intentionally takes NO `PrismaService` dependency: this makes it
 * structurally impossible to write the audit row on a different connection
 * than the caller's transaction, enforcing D4 (same-transaction atomicity)
 * by construction.
 *
 * See @doc/specs/admin-audit-log Technical Notes — "Implementation seam".
 */
@Injectable()
export class PrismaAuditEventRecorder extends AuditEventRecorderPort {
  async record(
    input: AuditEventInput,
    tx: AuditTransactionClient,
  ): Promise<void> {
    const snapshot = await this.resolveTargetSnapshot(
      input.targetType,
      input.targetId,
      tx,
    );

    // Snapshot fields go first so caller-provided context keys win on
    // collision — lets a caller supply `targetName` directly (e.g. when the
    // target row no longer exists by the time `record()` is reached).
    const context: Record<string, unknown> = {
      targetName: snapshot.targetName,
      ...input.context,
    };

    const visibility = ACTION_VISIBILITY[input.action];

    await tx.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        campusId: input.campusId,
        context: context as Prisma.InputJsonValue,
        beforeValue:
          input.beforeValue == null
            ? Prisma.DbNull
            : (input.beforeValue as Prisma.InputJsonValue),
        afterValue:
          input.afterValue == null
            ? Prisma.DbNull
            : (input.afterValue as Prisma.InputJsonValue),
        visibility,
        // createdAt intentionally omitted — relies on the DB default
        // (`@default(now())`) per @doc/specs/admin-audit-log FR-2.
      },
    });
  }

  private async resolveTargetSnapshot(
    targetType: AuditTargetType,
    targetId: string,
    tx: AuditTransactionClient,
  ): Promise<{ targetName: string | null }> {
    switch (targetType) {
      case "student": {
        const row = await tx.student.findUnique({
          where: { id: targetId },
          select: { fullName: true },
        });
        return { targetName: row?.fullName ?? null };
      }
      case "guardian": {
        const row = await tx.guardian.findUnique({
          where: { id: targetId },
          select: { fullName: true },
        });
        return { targetName: row?.fullName ?? null };
      }
      case "staff": {
        const row = await tx.staff.findUnique({
          where: { id: targetId },
          select: { fullName: true },
        });
        return { targetName: row?.fullName ?? null };
      }
      case "user": {
        // GRANT_ROLE / REVOKE_ROLE audit shape (D1 of
        // @doc/specs/direct-role-assignment-via-uow) puts the human-readable
        // identity in `context.actorName` — not `targetName`. The User row
        // itself has no name field (it lives on the linked Guardian/Staff
        // profile via back-reference), so resolving here would mean a
        // multi-join lookup that the audit shape does not consume. Return
        // null and let callers override with a caller-supplied snapshot if
        // they ever need one.
        return { targetName: null };
      }
      case "meal_menu": {
        const row = await tx.mealMenu.findUnique({
          where: { id: targetId },
          select: { title: true },
        });
        return { targetName: row?.title ?? null };
      }
      case "meal_menu_config": {
        // Config rows do not have a display name; the campus and changed
        // defaults are captured in context/beforeValue/afterValue by callers.
        return { targetName: null };
      }
      default: {
        // Exhaustiveness guard — if a new `AuditTargetType` member is added
        // to the port without updating this switch, this branch becomes
        // reachable and TS surfaces a compile error on `_exhaustive`.
        const _exhaustive: never = targetType;
        throw new Error(
          `Unsupported audit targetType: ${_exhaustive as string}`,
        );
      }
    }
  }
}
