import { Module } from "@nestjs/common";

import {
  ArchiveWeeklyPlanUseCase,
  CopyWeeklyPlanUseCase,
  CreateWeeklyPlanUseCase,
  GetActiveWeeklyPlanUseCase,
  GetWeeklyPlanByIdUseCase,
  GetWeeklyPlansUseCase,
  RestoreWeeklyPlanUseCase,
  UpdateWeeklyPlanUseCase,
} from "@/application/weekly-plan";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import {
  PrismaClassRepository,
  PrismaWeeklyPlanRepository,
} from "@/infra/persistence/prisma/repositories";

import { WeeklyPlanController } from "../controllers/weekly-plan.controller";
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
  controllers: [WeeklyPlanController],
  providers: [
    ArchiveWeeklyPlanUseCase,
    CopyWeeklyPlanUseCase,
    CreateWeeklyPlanUseCase,
    GetActiveWeeklyPlanUseCase,
    GetWeeklyPlanByIdUseCase,
    GetWeeklyPlansUseCase,
    RestoreWeeklyPlanUseCase,
    UpdateWeeklyPlanUseCase,
    ClerkAuthGuard,
    CampusGuard,
    PermissionsGuard,
    {
      provide: "WEEKLY_PLAN_REPOSITORY",
      useClass: PrismaWeeklyPlanRepository,
    },
    {
      provide: "CLASS_REPOSITORY",
      useClass: PrismaClassRepository,
    },
  ],
  exports: ["WEEKLY_PLAN_REPOSITORY", "CLASS_REPOSITORY"],
})
export class WeeklyPlanModule {}
