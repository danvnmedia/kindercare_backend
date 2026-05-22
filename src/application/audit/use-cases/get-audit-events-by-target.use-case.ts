import { BadRequestException, Injectable } from "@nestjs/common";

import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { AuditEvent, AuditTargetType } from "@/domain/audit";

const VALID_TARGET_TYPES: readonly AuditTargetType[] = [
  "student",
  "guardian",
  "staff",
];

export interface GetAuditEventsByTargetInput {
  campusId: string;
  targetType: string;
  targetId: string;
  params: StandardRequest;
}

/**
 * Returns the audit-event timeline for one entity (student/guardian/staff).
 * Powers the entity-history admin page (FR-5 in @doc/specs/admin-audit-log).
 *
 * Campus isolation is enforced by passing the request-scoped `campusId` as the
 * repository's `scope` argument — see @doc/guides/working-with-campuses for why
 * this MUST come from `@CampusContext()` and NOT from user-supplied filters.
 */
@Injectable()
export class GetAuditEventsByTargetUseCase {
  constructor(private readonly auditEventRepository: AuditEventRepository) {}

  async execute(
    input: GetAuditEventsByTargetInput,
  ): Promise<PaginatedResult<AuditEvent>> {
    if (!VALID_TARGET_TYPES.includes(input.targetType as AuditTargetType)) {
      throw new BadRequestException(
        `Invalid targetType "${input.targetType}". Expected one of: ${VALID_TARGET_TYPES.join(", ")}.`,
      );
    }

    return this.auditEventRepository.findByTarget(
      input.targetType as AuditTargetType,
      input.targetId,
      input.params,
      { campusId: input.campusId },
    );
  }
}
