import { Controller, Get, Patch, Body, UseGuards } from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
} from "@nestjs/swagger";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../decorators";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";

import {
  CampusSettingResponse,
  UpdateCampusSettingRequest,
} from "../dtos/campus-setting";

import { GetCampusSettingUseCase } from "@/application/content-management/use-cases/campus-setting/get-campus-setting.use-case";
import { UpdateCampusSettingUseCase } from "@/application/content-management/use-cases/campus-setting/update-campus-setting.use-case";
import { CampusSetting } from "@/domain/content-management";

@Controller("campus-settings")
@ApiTags("Campus Settings")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class CampusSettingController {
  constructor(
    private readonly getCampusSettingUseCase: GetCampusSettingUseCase,
    private readonly updateCampusSettingUseCase: UpdateCampusSettingUseCase,
  ) {}

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Campus settings retrieved successfully",
    type: CampusSettingResponse,
  })
  @ApiOperation({
    summary: "Get campus settings",
    description:
      "Retrieve campus settings for a given campus. If settings don't exist, returns default settings.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to get settings for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getCampusSettings(
    @CampusContext() campusId: string,
  ): Promise<CampusSetting> {
    return this.getCampusSettingUseCase.execute(campusId);
  }

  @Patch()
  @RequireCampusAccess()
  @UseGuards(RolesGuard)
  @Roles("admin", "super_admin")
  @StandardResponse({
    message: "Campus settings updated successfully",
    type: CampusSettingResponse,
  })
  @ApiOperation({
    summary: "Update campus settings",
    description:
      "Update campus settings for a given campus. Only admins can update settings. Only provided fields will be updated.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to update settings for",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async updateCampusSettings(
    @CampusContext() campusId: string,
    @Body() dto: UpdateCampusSettingRequest,
  ): Promise<CampusSetting> {
    return this.updateCampusSettingUseCase.execute(campusId, dto);
  }
}
