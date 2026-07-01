import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import {
  GetDailyMedicationAdministrationsUseCase,
  MedicationAdministrationQueueItem,
  MedicationAdministrationRecordResult,
  RecordMedicationAdministrationUseCase,
} from "@/application/medication";
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
  ListMedicationAdministrationsQuery,
  MedicationAdministrationQueueItemResponse,
  MedicationAdministrationRecordResponse,
  RecordMedicationAdministrationRequest,
} from "../dtos/medication";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

@ApiTags("Medication Administration")
@ApiBearerAuth("JWT")
@Controller("medication-administrations")
@UseGuards(ClerkAuthGuard)
export class MedicationAdministrationController {
  constructor(
    private readonly getDailyMedicationAdministrationsUseCase: GetDailyMedicationAdministrationsUseCase,
    private readonly recordMedicationAdministrationUseCase: RecordMedicationAdministrationUseCase,
  ) {}

  @Get("daily")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("medication_administration.read")
  @StandardResponse({
    message: "Medication administrations retrieved successfully",
    type: MedicationAdministrationQueueItemResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "List daily medication administrations",
    description:
      "Lists campus-scoped medication occurrences for a selected date, with derived due/overdue state and optional class, student, and status filters.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_administration.read permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to scope medication administration queue.",
  })
  async daily(
    @CampusContext() campusId: string,
    @Query() query: ListMedicationAdministrationsQuery,
  ): Promise<MedicationAdministrationQueueItem[]> {
    return this.getDailyMedicationAdministrationsUseCase.execute(
      campusId,
      query,
    );
  }

  @Post(":occurrenceId/record")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions(
    "medication_administration.create",
    "medication_administration.update",
  )
  @StandardResponse({
    message: "Medication administration recorded successfully",
    type: MedicationAdministrationRecordResponse,
  })
  @ApiOperation({
    summary: "Record or correct medication administration outcome",
    description:
      "Appends an administration log and atomically updates the occurrence latest outcome summary.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_administration.update permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to scope medication administration record.",
  })
  @ApiParam({
    name: "occurrenceId",
    description: "Medication administration occurrence ID",
    type: "string",
    format: "uuid",
  })
  async record(
    @CampusContext() campusId: string,
    @Param("occurrenceId", ParseUUIDPipe) occurrenceId: string,
    @Body() dto: RecordMedicationAdministrationRequest,
    @CurrentUser() currentUser: User,
  ): Promise<MedicationAdministrationRecordResult> {
    return this.recordMedicationAdministrationUseCase.execute(
      campusId,
      occurrenceId,
      dto,
      currentUser,
    );
  }
}
