import { AuditEvent as PrismaAuditEvent } from "@prisma/client";

import {
  AuditAction,
  AuditEvent,
  AuditTargetType,
  AuditVisibility,
} from "@/domain/audit";

export class PrismaAuditEventMapper {
  static toDomain(row: PrismaAuditEvent): AuditEvent {
    return AuditEvent.reconstitute(
      {
        actorId: row.actorId,
        // `action`, `targetType`, and `visibility` are plain strings in the
        // schema (FR-2 — new actions can be added without a migration). The
        // recorder enforces the union on writes; on read we trust the row.
        action: row.action as AuditAction,
        targetType: row.targetType as AuditTargetType,
        targetId: row.targetId,
        campusId: row.campusId,
        beforeValue:
          (row.beforeValue as Record<string, unknown> | null) ?? null,
        afterValue: (row.afterValue as Record<string, unknown> | null) ?? null,
        context: (row.context as Record<string, unknown>) ?? {},
        visibility: row.visibility as AuditVisibility,
        createdAt: row.createdAt,
      },
      row.id,
    );
  }
}
