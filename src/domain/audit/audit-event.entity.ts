import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";

import { AuditAction } from "./audit-action.enum";
import { AuditVisibility } from "./audit-visibility.enum";

/**
 * Discriminator for the audited entity. Mirrors the union exposed by
 * `AuditEventRecorderPort` so reads and writes share one vocabulary.
 *
 * `"user"` covers RBAC role grants (`GRANT_ROLE` / `REVOKE_ROLE` from
 * @doc/specs/direct-role-assignment-via-uow D1) — the target is the `User`
 * row receiving or losing the role-campus pair.
 */
export type AuditTargetType = "student" | "guardian" | "staff" | "user";

/**
 * AuditEvent — read-only projection of the `audit_event` table.
 *
 * The audit log is append-only (see @doc/architecture/audit-trail-soft-delete-patterns
 * and @doc/specs/admin-audit-log FR-2). Rows are written exclusively via
 * `AuditEventRecorderPort` inside an existing `$transaction`; they are NEVER
 * updated or deleted at the application layer. Consequently this entity exposes
 * getters only and offers a single `reconstitute()` factory used by the
 * persistence mapper.
 */
export interface AuditEventProps {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  campusId: string;
  beforeValue: Record<string, unknown> | null;
  afterValue: Record<string, unknown> | null;
  context: Record<string, unknown>;
  visibility: AuditVisibility;
  createdAt: Date;
}

export class AuditEvent extends Entity<AuditEventProps> {
  get actorId(): string {
    return this.props.actorId;
  }
  get action(): AuditAction {
    return this.props.action;
  }
  get targetType(): AuditTargetType {
    return this.props.targetType;
  }
  get targetId(): string {
    return this.props.targetId;
  }
  get campusId(): string {
    return this.props.campusId;
  }
  get beforeValue(): Record<string, unknown> | null {
    return this.props.beforeValue;
  }
  get afterValue(): Record<string, unknown> | null {
    return this.props.afterValue;
  }
  get context(): Record<string, unknown> {
    return this.props.context;
  }
  get visibility(): AuditVisibility {
    return this.props.visibility;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }

  public static reconstitute(props: AuditEventProps, id: string): AuditEvent {
    return new AuditEvent(props, new UniqueEntityID(id));
  }
}
