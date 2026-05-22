import { Module } from "@nestjs/common";

import { GetAuditEventsByActorUseCase } from "@/application/audit/use-cases/get-audit-events-by-actor.use-case";
import { GetAuditEventsByTargetUseCase } from "@/application/audit/use-cases/get-audit-events-by-target.use-case";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";

import { AuditController } from "../controllers/audit/audit.controller";
import { RequestContextModule } from "../context/request-context.module";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

import { CampusModule } from "./campus.module";

/**
 * Audit Module
 *
 * HTTP presentation module for the admin audit log
 * (see @doc/specs/admin-audit-log).
 *
 * Read-only — writes are emitted by feature use cases via
 * `AuditEventRecorderPort`, which `PrismaModule` already exposes.
 *
 * Imports:
 *  - PrismaModule: provides the `AuditEventRepository` binding (port → impl)
 *  - StandardResponseModule: pagination + response wrapping
 *  - RequestContextModule: request-scoped user/campus context for guards
 *  - CampusModule: `CAMPUS_REPOSITORY` for `CampusGuard`
 */
@Module({
  imports: [
    PrismaModule,
    StandardResponseModule,
    RequestContextModule,
    CampusModule,
  ],
  controllers: [AuditController],
  providers: [
    GetAuditEventsByTargetUseCase,
    GetAuditEventsByActorUseCase,
    ClerkAuthGuard,
    CampusGuard,
    PermissionsGuard,
  ],
})
export class AuditModule {}
