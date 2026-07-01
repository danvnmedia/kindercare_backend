import { Module } from "@nestjs/common";

import { GetStudentMedicationHistoryUseCase } from "@/application/medication";
import {
  CreateStudentHealthCheckupUseCase,
  CreateStudentHealthEventUseCase,
  CreateStudentHealthInstructionUseCase,
  GetActiveClassHealthInstructionsUseCase,
  GetActiveStudentHealthInstructionsUseCase,
  GetHealthCenterDailyItemsUseCase,
  GetStudentHealthCheckupByIdUseCase,
  GetStudentHealthCheckupsUseCase,
  GetStudentHealthEventByIdUseCase,
  GetStudentHealthEventsUseCase,
  GetStudentHealthInstructionByIdUseCase,
  GetStudentHealthInstructionsUseCase,
  GetStudentHealthProfileUseCase,
  UpdateStudentHealthCheckupUseCase,
  UpdateStudentHealthEventUseCase,
  UpdateStudentHealthInstructionUseCase,
  UpdateStudentHealthProfileUseCase,
} from "@/application/student-health";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import {
  PrismaClassRepository,
  PrismaEnrollmentRepository,
  PrismaMedicationRequestRepository,
  PrismaStudentHealthCheckupRepository,
  PrismaStudentHealthEventRepository,
  PrismaStudentHealthInstructionRepository,
  PrismaStudentHealthProfileRepository,
  PrismaStudentRepository,
} from "@/infra/persistence/prisma/repositories";

import { ClassHealthInstructionsController } from "../controllers/class-health-instructions.controller";
import { HealthCenterController } from "../controllers/health-center.controller";
import { StudentHealthController } from "../controllers/student-health.controller";
import { RequestContextModule } from "../context/request-context.module";
import { CampusGuard } from "../guards/campus.guard";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
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
    StudentHealthController,
    ClassHealthInstructionsController,
    HealthCenterController,
  ],
  providers: [
    CreateStudentHealthCheckupUseCase,
    CreateStudentHealthEventUseCase,
    CreateStudentHealthInstructionUseCase,
    GetActiveClassHealthInstructionsUseCase,
    GetActiveStudentHealthInstructionsUseCase,
    GetHealthCenterDailyItemsUseCase,
    GetStudentHealthCheckupByIdUseCase,
    GetStudentHealthCheckupsUseCase,
    GetStudentHealthEventByIdUseCase,
    GetStudentHealthEventsUseCase,
    GetStudentHealthInstructionByIdUseCase,
    GetStudentHealthInstructionsUseCase,
    GetStudentMedicationHistoryUseCase,
    GetStudentHealthProfileUseCase,
    UpdateStudentHealthCheckupUseCase,
    UpdateStudentHealthEventUseCase,
    UpdateStudentHealthInstructionUseCase,
    UpdateStudentHealthProfileUseCase,
    ClerkAuthGuard,
    CampusGuard,
    PermissionsGuard,
    {
      provide: "STUDENT_HEALTH_CHECKUP_REPOSITORY",
      useClass: PrismaStudentHealthCheckupRepository,
    },
    {
      provide: "STUDENT_HEALTH_EVENT_REPOSITORY",
      useClass: PrismaStudentHealthEventRepository,
    },
    {
      provide: "STUDENT_HEALTH_INSTRUCTION_REPOSITORY",
      useClass: PrismaStudentHealthInstructionRepository,
    },
    {
      provide: "STUDENT_HEALTH_PROFILE_REPOSITORY",
      useClass: PrismaStudentHealthProfileRepository,
    },
    {
      provide: "CLASS_REPOSITORY",
      useClass: PrismaClassRepository,
    },
    {
      provide: "ENROLLMENT_REPOSITORY",
      useClass: PrismaEnrollmentRepository,
    },
    {
      provide: "STUDENT_REPOSITORY",
      useClass: PrismaStudentRepository,
    },
    {
      provide: "MEDICATION_REQUEST_REPOSITORY",
      useClass: PrismaMedicationRequestRepository,
    },
  ],
  exports: [
    "STUDENT_HEALTH_CHECKUP_REPOSITORY",
    "STUDENT_HEALTH_EVENT_REPOSITORY",
    "STUDENT_HEALTH_INSTRUCTION_REPOSITORY",
    "STUDENT_HEALTH_PROFILE_REPOSITORY",
  ],
})
export class StudentHealthModule {}
