import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { AuditEvent, AuditTargetType } from "@/domain/audit";

/**
 * System-enforced scope applied to every audit-event read.
 *
 * `campusId` is appended to the Prisma `where` clause AFTER user-provided
 * `filter` query params, so it ALWAYS wins (see @doc/guides/working-with-campuses).
 * Callers MUST pass the validated `campusId` from the request context — never
 * a value sourced from query params or the body.
 */
export interface AuditEventReadScope {
  campusId: string;
}

/**
 * AuditEventRepository
 *
 * Read-side port for the audit log. Read endpoints (FR-5, FR-6 in
 * @doc/specs/admin-audit-log) consume this; writes flow through
 * `AuditEventRecorderPort` instead.
 *
 * Both queries:
 *   - return results ordered by `createdAt DESC` (uses the indexes from AC-10)
 *   - paginate via `StandardRequest` (limit/offset, max 50 — see
 *     @doc/guides/pagination-and-filtering)
 *   - filter campus via `scope.campusId`, NEVER through `allowedFilterFields`
 *
 * Abstract class (not interface) for DI binding — matches the convention used
 * by `AuditEventRecorderPort` and `UnitOfWorkPort`.
 */
export abstract class AuditEventRepository {
  abstract findByTarget(
    targetType: AuditTargetType,
    targetId: string,
    params: StandardRequest,
    scope: AuditEventReadScope,
  ): Promise<PaginatedResult<AuditEvent>>;

  abstract findByActor(
    actorId: string,
    params: StandardRequest,
    scope: AuditEventReadScope,
  ): Promise<PaginatedResult<AuditEvent>>;
}
