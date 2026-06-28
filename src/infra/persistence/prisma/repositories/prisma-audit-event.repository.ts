import { Injectable } from "@nestjs/common";

import {
  AuditEventReadScope,
  AuditEventRepository,
} from "@/application/audit/ports/audit-event.repository";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { AuditEvent, AuditTargetType } from "@/domain/audit";

import { PrismaAuditEventMapper } from "../mapper/prisma-audit-event.mapper";
import { PrismaService } from "../prisma.service";

@Injectable()
export class PrismaAuditEventRepository extends AuditEventRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {
    super();
  }

  async findByTarget(
    targetType: AuditTargetType,
    targetId: string,
    params: StandardRequest,
    scope: AuditEventReadScope,
  ): Promise<PaginatedResult<AuditEvent>> {
    return this.execute(params, scope, { targetType, targetId });
  }

  async findByActor(
    actorId: string,
    params: StandardRequest,
    scope: AuditEventReadScope,
  ): Promise<PaginatedResult<AuditEvent>> {
    return this.execute(params, scope, { actorId });
  }

  /**
   * `targetType`/`targetId`/`actorId` are use-case arguments (not user-supplied
   * filters), so they go in `options.where` rather than `allowedFilterFields`.
   * `scope` is then applied LAST by `executeQuery` and CANNOT be overridden by
   * `?filter=...` query params — this is what enforces campus isolation
   * (see @doc/guides/working-with-campuses#prisma-implementation--system-enforced-campus-scope).
   */
  private execute(
    params: StandardRequest,
    scope: AuditEventReadScope,
    where: Record<string, unknown>,
  ): Promise<PaginatedResult<AuditEvent>> {
    return this.queryService.executeQuery<AuditEvent>(
      this.prisma,
      "auditEvent",
      params,
      {
        where,
        orderBy: { createdAt: "desc" },
        scope,
        allowedFilterFields: [],
        allowedSortFields: [],
      },
      PrismaAuditEventMapper,
    );
  }
}
