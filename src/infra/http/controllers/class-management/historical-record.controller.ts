import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { User } from "@/domain/user-management/user.entity";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import {
  ArchiveHistoricalRecordUseCase,
  CorrectHistoricalRecordUseCase,
  DeleteHistoricalRecordUseCase,
  ExportHistoricalRecordUseCase,
  RedactHistoricalRecordUseCase,
} from "@/application/class-management/use-cases/historical-records";
import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../../decorators";
import { Permissions } from "../../decorators/permissions.decorator";
import {
  CorrectHistoricalRecordRequest,
  DeleteHistoricalRecordResponse,
  HistoricalRecordEnvelopeResponse,
  HistoricalRetentionActionRequest,
  RedactHistoricalRecordRequest,
} from "../../dtos/class-management";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { parseHistoricalRecordType } from "@/application/class-management/use-cases/historical-records/historical-record-workflow";

@Controller("historical-records")
@ApiTags("Historical Records")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard, PermissionsGuard)
export class HistoricalRecordController {
  constructor(
    private readonly correctHistoricalRecordUseCase: CorrectHistoricalRecordUseCase,
    private readonly exportHistoricalRecordUseCase: ExportHistoricalRecordUseCase,
    private readonly archiveHistoricalRecordUseCase: ArchiveHistoricalRecordUseCase,
    private readonly redactHistoricalRecordUseCase: RedactHistoricalRecordUseCase,
    private readonly deleteHistoricalRecordUseCase: DeleteHistoricalRecordUseCase,
  ) {}

  @Post(":recordType/:recordId/corrections")
  @RequireCampusAccess()
  @Permissions("historical_records.correct")
  @StandardResponse({
    message: "Historical record correction appended",
    type: HistoricalRecordEnvelopeResponse,
  })
  @ApiOperation({ summary: "Append a correction to a finalized record" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiParam({
    name: "recordType",
    enum: ["enrollment", "school-year-enrollment"],
  })
  @ApiParam({ name: "recordId", type: "string", format: "uuid" })
  async correct(
    @CampusContext() campusId: string,
    @Param("recordType") recordType: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
    @Body() dto: CorrectHistoricalRecordRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.toEnvelope(
      await this.correctHistoricalRecordUseCase.execute(
        {
          campusId,
          recordType: parseHistoricalRecordType(recordType),
          recordId,
          reason: dto.reason,
          afterValue: dto.afterValue,
        },
        currentUser,
      ),
    );
  }

  @Get(":recordType/:recordId/export")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Historical record export generated",
    type: HistoricalRecordEnvelopeResponse,
  })
  @ApiOperation({ summary: "Export one historical record" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  @ApiParam({
    name: "recordType",
    enum: ["enrollment", "school-year-enrollment"],
  })
  @ApiParam({ name: "recordId", type: "string", format: "uuid" })
  async export(
    @CampusContext() campusId: string,
    @Param("recordType") recordType: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.toEnvelope(
      await this.exportHistoricalRecordUseCase.execute(
        {
          campusId,
          recordType: parseHistoricalRecordType(recordType),
          recordId,
        },
        currentUser,
      ),
    );
  }

  @Post(":recordType/:recordId/archive")
  @RequireCampusAccess()
  @Permissions("historical_records.archive")
  @StandardResponse({
    message: "Historical record archived",
    type: HistoricalRecordEnvelopeResponse,
  })
  @ApiOperation({
    summary: "Archive a historical record under retention policy",
  })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async archive(
    @CampusContext() campusId: string,
    @Param("recordType") recordType: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
    @Body() dto: HistoricalRetentionActionRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.toEnvelope(
      await this.archiveHistoricalRecordUseCase.execute(
        {
          campusId,
          recordType: parseHistoricalRecordType(recordType),
          recordId,
          reason: dto.reason,
        },
        currentUser,
      ),
    );
  }

  @Post(":recordType/:recordId/redact")
  @RequireCampusAccess()
  @Permissions("historical_records.redact")
  @StandardResponse({
    message: "Historical record redacted",
    type: HistoricalRecordEnvelopeResponse,
  })
  @ApiOperation({
    summary: "Redact/anonymize eligible historical snapshot fields",
  })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async redact(
    @CampusContext() campusId: string,
    @Param("recordType") recordType: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
    @Body() dto: RedactHistoricalRecordRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.toEnvelope(
      await this.redactHistoricalRecordUseCase.execute(
        {
          campusId,
          recordType: parseHistoricalRecordType(recordType),
          recordId,
          reason: dto.reason,
        },
        currentUser,
      ),
    );
  }

  @Delete(":recordType/:recordId")
  @RequireCampusAccess()
  @Permissions("historical_records.delete")
  @StandardResponse({
    message: "Historical record deleted",
    type: DeleteHistoricalRecordResponse,
  })
  @ApiOperation({ summary: "Delete an eligible historical record" })
  @ApiHeader({ name: CAMPUS_ID_HEADER, required: true })
  async delete(
    @CampusContext() campusId: string,
    @Param("recordType") recordType: string,
    @Param("recordId", ParseUUIDPipe) recordId: string,
    @Body() dto: HistoricalRetentionActionRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.deleteHistoricalRecordUseCase.execute(
      {
        campusId,
        recordType: parseHistoricalRecordType(recordType),
        recordId,
        reason: dto.reason,
      },
      currentUser,
    );
  }

  private toEnvelope(resolved: {
    recordType: "ENROLLMENT" | "SCHOOL_YEAR_ENROLLMENT";
    studentId: string;
    finalized: boolean;
    view: unknown;
  }): HistoricalRecordEnvelopeResponse {
    return {
      recordType: resolved.recordType,
      studentId: resolved.studentId,
      finalized: resolved.finalized,
      enrollment:
        resolved.recordType === "ENROLLMENT"
          ? (resolved.view as HistoricalRecordEnvelopeResponse["enrollment"])
          : undefined,
      schoolYearEnrollment:
        resolved.recordType === "SCHOOL_YEAR_ENROLLMENT"
          ? (resolved.view as HistoricalRecordEnvelopeResponse["schoolYearEnrollment"])
          : undefined,
    };
  }
}
