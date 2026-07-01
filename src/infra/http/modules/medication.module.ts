import { Module } from "@nestjs/common";

import {
  CancelMedicationRequestUseCase,
  CreateMedicationRequestUseCase,
  GetDailyMedicationAdministrationsUseCase,
  GetHealthCenterMedicationSummaryUseCase,
  GetMedicationRequestByIdUseCase,
  GetMedicationRequestsUseCase,
  GetMyMedicationRequestByIdUseCase,
  GetMyMedicationRequestsUseCase,
  RecordMedicationAdministrationUseCase,
  RespondMedicationRequestUseCase,
  ReviewMedicationRequestUseCase,
} from "@/application/medication";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import {
  PrismaGuardianRepository,
  PrismaMedicationAdministrationRepository,
  PrismaMedicationRequestRepository,
} from "@/infra/persistence/prisma/repositories";

import { HealthCenterMedicationSummaryController } from "../controllers/health-center-medication-summary.controller";
import { MedicationAdministrationController } from "../controllers/medication-administration.controller";
import { MedicationRequestController } from "../controllers/medication-request.controller";
import { ParentMedicationRequestController } from "../controllers/parent-medication-request.controller";
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
  controllers: [
    ParentMedicationRequestController,
    MedicationRequestController,
    MedicationAdministrationController,
    HealthCenterMedicationSummaryController,
  ],
  providers: [
    CancelMedicationRequestUseCase,
    CreateMedicationRequestUseCase,
    GetDailyMedicationAdministrationsUseCase,
    GetHealthCenterMedicationSummaryUseCase,
    GetMedicationRequestByIdUseCase,
    GetMedicationRequestsUseCase,
    GetMyMedicationRequestByIdUseCase,
    GetMyMedicationRequestsUseCase,
    RecordMedicationAdministrationUseCase,
    RespondMedicationRequestUseCase,
    ReviewMedicationRequestUseCase,
    ClerkAuthGuard,
    CampusGuard,
    HydrateCurrentUserGuard,
    PermissionsGuard,
    {
      provide: "MEDICATION_REQUEST_REPOSITORY",
      useClass: PrismaMedicationRequestRepository,
    },
    {
      provide: "MEDICATION_ADMINISTRATION_REPOSITORY",
      useClass: PrismaMedicationAdministrationRepository,
    },
    {
      provide: "GUARDIAN_REPOSITORY",
      useClass: PrismaGuardianRepository,
    },
  ],
  exports: [
    "MEDICATION_REQUEST_REPOSITORY",
    "MEDICATION_ADMINISTRATION_REPOSITORY",
  ],
})
export class MedicationModule {}
