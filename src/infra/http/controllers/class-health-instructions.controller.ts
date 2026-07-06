import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { GetActiveClassHealthInstructionsUseCase } from "@/application/student-health";
import { StandardResponse } from "@/core/modules/standard-response/decorators";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  ActiveClassHealthInstructionsResponseDto,
  ActiveHealthInstructionsQuery,
} from "../dtos/student-health";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

@ApiTags("Student Health")
@ApiBearerAuth("JWT")
@Controller("classes")
@UseGuards(ClerkAuthGuard)
export class ClassHealthInstructionsController {
  constructor(
    private readonly getActiveClassInstructionsUseCase: GetActiveClassHealthInstructionsUseCase,
  ) {}

  @Get(":classId/health-instructions/active")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Active class health instructions retrieved successfully",
    type: ActiveClassHealthInstructionsResponseDto,
  })
  @ApiOperation({
    summary: "Get active class health instructions",
    description:
      "Returns active health instructions grouped by active students in the selected class and reference date. This read creates no administration events and no audit row.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "classId",
    description: "Class UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Class was not found in the selected campus.",
  })
  async getActiveClassInstructions(
    @CampusContext() campusId: string,
    @Param("classId", ParseUUIDPipe) classId: string,
    @Query() query: ActiveHealthInstructionsQuery,
  ) {
    return this.getActiveClassInstructionsUseCase.execute({
      campusId,
      classId,
      date: query.date,
    });
  }
}
