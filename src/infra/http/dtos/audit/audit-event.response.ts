import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

/**
 * Wire format for audit-event reads.
 *
 * Mirrors the columns in `audit_event` plus the recorder-enriched
 * `context.targetName`. The `@StandardResponse` interceptor projects
 * `AuditEvent` domain entities into this shape via `@Expose()` — see
 * @doc/patterns/standard-response-pattern.
 */
export class AuditEventResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174001",
    description: "UUID of the User who performed the action.",
  })
  actorId: string;

  @Expose()
  @ApiProperty({
    example: "TRANSFER_STUDENT",
    description:
      "Action code from the audit-action vocabulary (see AUDIT_ACTIONS).",
  })
  action: string;

  @Expose()
  @ApiProperty({
    example: "student",
    enum: ["student", "guardian", "staff", "role"],
    description: "Discriminator for the audited entity.",
  })
  targetType: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  targetId: string;

  @Expose()
  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174003",
    description: "Campus the row belongs to (system-enforced on reads).",
  })
  campusId: string;

  @Expose()
  @ApiProperty({
    nullable: true,
    description:
      "Changed-field snapshot before the mutation. Populated for EDIT_* actions; null otherwise.",
    type: Object,
  })
  beforeValue: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({
    nullable: true,
    description:
      "Changed-field snapshot after the mutation. Populated for EDIT_* actions; null otherwise.",
    type: Object,
  })
  afterValue: Record<string, unknown> | null;

  @Expose()
  @ApiProperty({
    description:
      "Per-action context snapshot. Shape varies by action — see @doc/references/audit-event-context-shapes.",
    type: Object,
  })
  context: Record<string, unknown>;

  @Expose()
  @ApiProperty({
    example: "ADMIN",
    enum: ["ADMIN", "GUARDIAN_VISIBLE"],
    description: "Audience that may see this row (v1 always 'ADMIN').",
  })
  visibility: string;

  @Expose()
  @ApiProperty({ example: "2026-05-20T08:30:00.000Z" })
  createdAt: Date;
}
