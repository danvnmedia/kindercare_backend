import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import {
  GetHealthCenterDailyItemsUseCase,
  HealthCenterDailyItemsResponse,
} from "@/application/student-health";
import { StandardResponse } from "@/core/modules/standard-response/decorators";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  HealthCenterDailyItemsQuery,
  HealthCenterDailyItemsResponseDto,
} from "../dtos/student-health";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

@ApiTags("Health Center")
@ApiBearerAuth("JWT")
@Controller("health-center")
@UseGuards(ClerkAuthGuard)
export class HealthCenterController {
  constructor(
    private readonly getDailyItemsUseCase: GetHealthCenterDailyItemsUseCase,
  ) {}

  @Get("daily-items")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Health Center daily items retrieved successfully",
    type: HealthCenterDailyItemsResponseDto,
  })
  @ApiOperation({
    summary: "Get Health Center daily items",
    description:
      "Returns active health instructions and current-open health events for the selected campus/date, optionally filtered to students enrolled in one class on that date. This read creates no audit row.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiBadRequestResponse({
    description: "Invalid date, classId, or pagination query parameter.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Class was not found in the selected campus.",
  })
  async getDailyItems(
    @CampusContext() campusId: string,
    @Query() query: HealthCenterDailyItemsQuery,
  ): Promise<HealthCenterDailyItemsResponse> {
    return this.getDailyItemsUseCase.execute({
      campusId,
      date: query.date,
      classId: query.classId,
      instructions: {
        offset: query.instructionsOffset,
        limit: query.instructionsLimit,
      },
      events: {
        offset: query.eventsOffset,
        limit: query.eventsLimit,
      },
    });
  }
}
