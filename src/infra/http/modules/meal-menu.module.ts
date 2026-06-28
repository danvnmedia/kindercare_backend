import { Module } from "@nestjs/common";

import {
  ArchiveMealMenuUseCase,
  CopyMealMenuUseCase,
  CreateMealMenuUseCase,
  GetEffectiveClassMealMenuUseCase,
  GetMealMenuByIdUseCase,
  GetMealMenuConfigUseCase,
  GetMealMenusUseCase,
  RestoreMealMenuUseCase,
  UpdateMealMenuConfigUseCase,
  UpdateMealMenuUseCase,
} from "@/application/meal-menu";
import { StandardResponseModule } from "@/core/modules/standard-response";
import { PrismaModule } from "@/infra/persistence/prisma/prisma.module";
import {
  PrismaClassRepository,
  PrismaGradeLevelRepository,
  PrismaMealMenuConfigRepository,
  PrismaMealMenuRepository,
} from "@/infra/persistence/prisma/repositories";

import { MealMenuConfigController } from "../controllers/meal-menu-config.controller";
import { MealMenuController } from "../controllers/meal-menu.controller";
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
  controllers: [MealMenuConfigController, MealMenuController],
  providers: [
    ArchiveMealMenuUseCase,
    CopyMealMenuUseCase,
    CreateMealMenuUseCase,
    GetEffectiveClassMealMenuUseCase,
    GetMealMenuByIdUseCase,
    GetMealMenuConfigUseCase,
    GetMealMenusUseCase,
    RestoreMealMenuUseCase,
    UpdateMealMenuConfigUseCase,
    UpdateMealMenuUseCase,
    ClerkAuthGuard,
    CampusGuard,
    PermissionsGuard,
    {
      provide: "MEAL_MENU_REPOSITORY",
      useClass: PrismaMealMenuRepository,
    },
    {
      provide: "MEAL_MENU_CONFIG_REPOSITORY",
      useClass: PrismaMealMenuConfigRepository,
    },
    {
      provide: "GRADE_LEVEL_REPOSITORY",
      useClass: PrismaGradeLevelRepository,
    },
    {
      provide: "CLASS_REPOSITORY",
      useClass: PrismaClassRepository,
    },
  ],
  exports: [
    "MEAL_MENU_REPOSITORY",
    "MEAL_MENU_CONFIG_REPOSITORY",
    "GRADE_LEVEL_REPOSITORY",
    "CLASS_REPOSITORY",
  ],
})
export class MealMenuModule {}
