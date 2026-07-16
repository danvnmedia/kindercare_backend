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
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
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
  @Permissions(
    "student_health.read",
    "medication_administration.read",
    "medication_request.list",
  )
  @StandardResponse({
    message: "Health Center daily items retrieved successfully",
    type: HealthCenterDailyItemsResponseDto,
  })
  @ApiOperation({
    summary: "Get Health Center daily items",
    description:
      "Returns a permission-aware daily read model for active health instructions, current-open health events, medication administration work, and authoritative counts. This read creates no audit row.",
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
    description:
      "Requires campus access and at least one supported health or medication read/list permission.",
  })
  @ApiNotFoundResponse({
    description: "Class was not found in the selected campus.",
  })
  async getDailyItems(
    @CampusContext() campusId: string,
    @Query() query: HealthCenterDailyItemsQuery,
    @CurrentUser() currentUser: User,
  ): Promise<HealthCenterDailyItemsResponse> {
    return this.getDailyItemsUseCase.execute(
      {
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
        medications: {
          offset: query.medicationsOffset,
          limit: query.medicationsLimit,
        },
        summaryOnly: query.summaryOnly,
      },
      currentUser,
    );
  }
}
