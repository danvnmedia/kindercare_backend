import {
  Controller,
  Get,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { GetAuditEventsByActorUseCase } from "@/application/audit/use-cases/get-audit-events-by-actor.use-case";
import { GetAuditEventsByTargetUseCase } from "@/application/audit/use-cases/get-audit-events-by-target.use-case";
import {
  StandardRequestParam,
  StandardResponse,
} from "@/core/modules/standard-response/decorators";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  RequireCampusAccess,
} from "../../decorators";
import { Permissions } from "../../decorators/permissions.decorator";
import { AuditEventResponse } from "../../dtos/audit";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";

/**
 * Read-side endpoints for the admin audit log (@doc/specs/admin-audit-log).
 *
 *  - `GET /audit/by-target` — entity-history page (FR-5)
 *  - `GET /audit/by-actor`  — actor-activity page (FR-6)
 *
 * Auth contract (AC-5/AC-6 in the spec):
 *   - 200 with valid auth + `audit.read` permission
 *   - 401 without auth (ClerkAuthGuard)
 *   - 403 without `audit.read` (PermissionsGuard)
 *   - empty PaginatedResult for cross-campus reads (system-enforced via
 *     `scope: { campusId }` in the repository — the `X-Campus-Id` header is
 *     NOT a user-controllable filter)
 *
 * Pagination follows the project convention (DESC by `createdAt`, capped at
 * 50 rows per page — see @doc/guides/pagination-and-filtering).
 */
@ApiTags("Audit")
@ApiBearerAuth("JWT")
@Controller("audit")
@UseGuards(ClerkAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(
    private readonly getAuditEventsByTargetUseCase: GetAuditEventsByTargetUseCase,
    private readonly getAuditEventsByActorUseCase: GetAuditEventsByActorUseCase,
  ) {}

  @Get("by-target")
  @RequireCampusAccess()
  @Permissions("audit.read")
  @StandardResponse({
    type: AuditEventResponse,
    isArray: true,
    message: "Audit events retrieved successfully",
  })
  @ApiOperation({
    summary: "Get audit events for a target entity",
    description:
      "Returns audit events for the given student/guardian/staff target within the current campus, DESC by createdAt. Pagination via limit/offset.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
    required: true,
  })
  @ApiQuery({
    name: "targetType",
    enum: ["student", "guardian", "staff"],
    required: true,
  })
  @ApiQuery({ name: "targetId", required: true, format: "uuid" })
  async findByTarget(
    @CampusContext() campusId: string,
    @Query("targetType") targetType: string,
    @Query("targetId", new ParseUUIDPipe({ version: "4" })) targetId: string,
    @StandardRequestParam() params: StandardRequestDto,
  ) {
    return this.getAuditEventsByTargetUseCase.execute({
      campusId,
      targetType,
      targetId,
      params,
    });
  }

  @Get("by-actor")
  @RequireCampusAccess()
  @Permissions("audit.read")
  @StandardResponse({
    type: AuditEventResponse,
    isArray: true,
    message: "Audit events retrieved successfully",
  })
  @ApiOperation({
    summary: "Get audit events emitted by an actor",
    description:
      "Returns audit events authored by the given actor within the current campus, DESC by createdAt. Pagination via limit/offset.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
    required: true,
  })
  @ApiQuery({ name: "actorId", required: true, format: "uuid" })
  async findByActor(
    @CampusContext() campusId: string,
    @Query("actorId", new ParseUUIDPipe({ version: "4" })) actorId: string,
    @StandardRequestParam() params: StandardRequestDto,
  ) {
    return this.getAuditEventsByActorUseCase.execute({
      campusId,
      actorId,
      params,
    });
  }
}
