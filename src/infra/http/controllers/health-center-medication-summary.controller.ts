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
  RequireAllPermissions,
} from "../decorators";
import {
  HealthCenterMedicationSummaryQuery,
  HealthCenterMedicationSummaryResponseDto,
} from "../dtos/medication";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { AllPermissionsGuard } from "../guards/all-permissions.guard";

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
  @UseGuards(AllPermissionsGuard)
  @RequireAllPermissions(
    "medication_request.read",
    "medication_administration.read",
  )
  @StandardResponse({
    message: "Health Center medication summary retrieved successfully",
    type: HealthCenterMedicationSummaryResponseDto,
  })
  @ApiOperation({
    summary: "Get Health Center medication summary",
    deprecated: true,
    description:
      "Deprecated compatibility endpoint. New Health Center clients should use GET /api/health-center/daily-items, optionally with summaryOnly=true. This route remains operational and response-compatible during migration.",
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
      "Requires campus access plus both medication_request.read and medication_administration.read permissions, or global Super Admin access.",
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
