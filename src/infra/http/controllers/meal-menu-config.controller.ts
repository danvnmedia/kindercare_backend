import { Body, Controller, Get, Put, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import {
  GetMealMenuConfigUseCase,
  UpdateMealMenuConfigUseCase,
} from "@/application/meal-menu";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { MealMenuConfig } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  MealMenuConfigResponse,
  UpdateMealMenuConfigRequest,
} from "../dtos/meal-menu";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

@ApiTags("Meal Menus")
@ApiBearerAuth("JWT")
@Controller("meal-menus")
@UseGuards(ClerkAuthGuard)
export class MealMenuConfigController {
  constructor(
    private readonly getMealMenuConfigUseCase: GetMealMenuConfigUseCase,
    private readonly updateMealMenuConfigUseCase: UpdateMealMenuConfigUseCase,
  ) {}

  @Get("config")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu_config.read")
  @StandardResponse({
    message: "Meal menu config retrieved successfully",
    type: MealMenuConfigResponse,
  })
  @ApiOperation({
    summary: "Get meal-menu config",
    description:
      "Returns saved campus-scoped meal-menu defaults, or virtual defaults when no row exists. Requires meal_menu_config.read permission. This read is side-effect free and never trusts campusId from the request body.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu_config.read permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  async getConfig(@CampusContext() campusId: string): Promise<MealMenuConfig> {
    return this.getMealMenuConfigUseCase.execute(campusId);
  }

  @Put("config")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu_config.update")
  @StandardResponse({
    message: "Meal menu config updated successfully",
    type: MealMenuConfigResponse,
  })
  @ApiOperation({
    summary: "Update meal-menu config",
    description:
      "Upserts campus-scoped meal-menu defaults for future menus only. Requires meal_menu_config.update permission. Existing menu snapshots are not mutated.",
  })
  @ApiBody({ type: UpdateMealMenuConfigRequest })
  @ApiBadRequestResponse({
    description: "Invalid operatingDays or defaultMealSlots config values.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and meal_menu_config.update permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  async updateConfig(
    @CampusContext() campusId: string,
    @Body() dto: UpdateMealMenuConfigRequest,
    @CurrentUser() currentUser: User,
  ): Promise<MealMenuConfig> {
    return this.updateMealMenuConfigUseCase.execute(campusId, dto, currentUser);
  }
}
