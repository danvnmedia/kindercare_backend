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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import {
  GetMedicationRequestByIdUseCase,
  GetMedicationRequestsUseCase,
  ReviewMedicationRequestUseCase,
} from "@/application/medication";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { MedicationRequest } from "@/domain/medication";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  ListStaffMedicationRequestsQuery,
  MedicationRequestDetailResponse,
  MedicationRequestResponse,
  ReviewMedicationRequestRequest,
} from "../dtos/medication";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

const MEDICATION_REQUEST_ALLOWED_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "startDate",
];

const MEDICATION_REQUEST_ALLOWED_FILTER_FIELDS = [
  "status",
  "studentId",
  "createdAt",
  "updatedAt",
  "startDate",
  "endDate",
];

@ApiTags("Medication Requests")
@ApiBearerAuth("JWT")
@Controller("medication-requests")
@UseGuards(ClerkAuthGuard)
export class MedicationRequestController {
  constructor(
    private readonly getMedicationRequestsUseCase: GetMedicationRequestsUseCase,
    private readonly getMedicationRequestByIdUseCase: GetMedicationRequestByIdUseCase,
    private readonly reviewMedicationRequestUseCase: ReviewMedicationRequestUseCase,
  ) {}

  @Get()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("medication_request.list")
  @StandardResponse({
    message: "Medication requests retrieved successfully",
    type: MedicationRequestResponse,
    isPaginated: true,
    allowedSortFields: MEDICATION_REQUEST_ALLOWED_SORT_FIELDS,
    allowedFilterFields: MEDICATION_REQUEST_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List campus medication requests",
    description:
      "Lists campus-scoped medication requests for permitted staff with standard pagination plus medication-specific filters.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_request.list permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to scope medication request list.",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: ListStaffMedicationRequestsQuery,
  ): Promise<PaginatedResult<MedicationRequest>> {
    return this.getMedicationRequestsUseCase.execute(campusId, query);
  }

  @Get(":requestId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("medication_request.read")
  @StandardResponse({
    message: "Medication request retrieved successfully",
    type: MedicationRequestDetailResponse,
  })
  @ApiOperation({
    summary: "Get campus medication request",
    description:
      "Returns one medication request detail in the selected campus for permitted staff.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_request.read permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to scope medication request lookup.",
  })
  @ApiParam({
    name: "requestId",
    description: "Medication request ID",
    type: "string",
    format: "uuid",
  })
  @ApiNotFoundResponse({
    description: "Medication request was not found in the selected campus.",
  })
  async findOne(
    @CampusContext() campusId: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ): Promise<MedicationRequest> {
    return this.getMedicationRequestByIdUseCase.execute(campusId, requestId);
  }

  @Post(":requestId/review")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("medication_request.update")
  @StandardResponse({
    message: "Medication request reviewed successfully",
    type: MedicationRequestResponse,
  })
  @ApiOperation({
    summary: "Review medication request",
    description:
      "Approves, rejects, or requests more information for a submitted campus medication request. Terminal requests and requests at or beyond their campus-local expiration boundary return conflict; a late active request is first persisted as EXPIRED.",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_request.update permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID to scope medication request review.",
  })
  @ApiParam({
    name: "requestId",
    description: "Medication request ID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description: "Invalid review action, note, or non-terminal workflow state.",
  })
  @ApiConflictResponse({
    description:
      "The request is terminal or reached its campus-local expiration boundary.",
  })
  @ApiNotFoundResponse({
    description: "Medication request was not found in the selected campus.",
  })
  async review(
    @CampusContext() campusId: string,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: ReviewMedicationRequestRequest,
    @CurrentUser() currentUser: User,
  ): Promise<MedicationRequest> {
    return this.reviewMedicationRequestUseCase.execute(
      campusId,
      requestId,
      dto,
      currentUser,
    );
  }
}
