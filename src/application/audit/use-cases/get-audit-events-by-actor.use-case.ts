import { Injectable } from "@nestjs/common";

import { AuditEventRepository } from "@/application/audit/ports/audit-event.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { AuditEvent } from "@/domain/audit";

export interface GetAuditEventsByActorInput {
  campusId: string;
  actorId: string;
  params: StandardRequest;
}

/**
 * Returns every audit event emitted by a single actor within the current
 * campus. Powers the actor-activity admin page (FR-6 in
 * @doc/specs/admin-audit-log).
 *
 * Cross-campus reads are blocked at the repository layer by the
 * `scope.campusId` filter (see @doc/guides/working-with-campuses) — an actor
 * who is active in multiple campuses will surface different rows depending on
 * which campus context the caller is in.
 */
@Injectable()
export class GetAuditEventsByActorUseCase {
  constructor(private readonly auditEventRepository: AuditEventRepository) {}

  async execute(
    input: GetAuditEventsByActorInput,
  ): Promise<PaginatedResult<AuditEvent>> {
    return this.auditEventRepository.findByActor(input.actorId, input.params, {
      campusId: input.campusId,
    });
  }
}
