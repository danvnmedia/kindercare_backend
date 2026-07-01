import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";

import {
  GetHealthCenterMedicationSummaryUseCase,
  HealthCenterMedicationSummaryResponse,
} from "@/application/medication";
import { StandardResponse } from "@/core/modules/standard-response/decorators";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  HealthCenterMedicationSummaryQuery,
  HealthCenterMedicationSummaryResponseDto,
} from "../dtos/medication";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

@ApiTags("Health Center")
@ApiBearerAuth("JWT")
@Controller("health-center")
@UseGuards(ClerkAuthGuard)
export class HealthCenterMedicationSummaryController {
  constructor(
    private readonly getHealthCenterMedicationSummaryUseCase: GetHealthCenterMedicationSummaryUseCase,
  ) {}

  @Get("medication-summary")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("medication_request.read")
  @StandardResponse({
    message: "Health Center medication summary retrieved successfully",
    type: HealthCenterMedicationSummaryResponseDto,
  })
  @ApiOperation({
    summary: "Get Health Center medication summary",
    description:
      "Returns campus-scoped medication request and administration counts for the Health Center without modifying the daily-items instruction or event arrays.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced medication scope.",
  })
  @ApiBadRequestResponse({
    description: "Invalid date query parameter.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_request.read permission.",
  })
  async getSummary(
    @CampusContext() campusId: string,
    @Query() query: HealthCenterMedicationSummaryQuery,
  ): Promise<HealthCenterMedicationSummaryResponse> {
    return this.getHealthCenterMedicationSummaryUseCase.execute(
      campusId,
      query,
    );
  }
}
