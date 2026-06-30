import { Module } from "@nestjs/common";

import {
  CreateAbsenceRequestUseCase,
  GetAbsenceRequestByIdUseCase,
  GetAbsenceRequestsUseCase,
  GetMyAbsenceRequestsUseCase,
  ReviewAbsenceRequestUseCase,
} from "@/application/absence-request";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import {
  PrismaAbsenceRequestRepository,
  PrismaGuardianRepository,
} from "@/infra/persistence/prisma/repositories";

import { AbsenceRequestController } from "../controllers/absence-request.controller";
import { RequestContextModule } from "../context/request-context.module";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../guards/hydrate-current-user.guard";
import { PermissionsGuard } from "../guards/permissions.guard";
import { CampusModule } from "./campus.module";

@Module({
  imports: [
    PrismaModule,
    StandardResponseModule,
    RequestContextModule,
    CampusModule,
  ],
  controllers: [AbsenceRequestController],
  providers: [
    CreateAbsenceRequestUseCase,
    GetAbsenceRequestByIdUseCase,
    GetAbsenceRequestsUseCase,
    GetMyAbsenceRequestsUseCase,
    ReviewAbsenceRequestUseCase,
    ClerkAuthGuard,
    CampusGuard,
    HydrateCurrentUserGuard,
    PermissionsGuard,
    {
      provide: "ABSENCE_REQUEST_REPOSITORY",
      useClass: PrismaAbsenceRequestRepository,
    },
    {
      provide: "GUARDIAN_REPOSITORY",
      useClass: PrismaGuardianRepository,
    },
  ],
  exports: ["ABSENCE_REQUEST_REPOSITORY"],
})
export class AbsenceRequestModule {}
