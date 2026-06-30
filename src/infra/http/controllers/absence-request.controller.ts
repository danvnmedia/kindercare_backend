import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  CreateAbsenceRequestUseCase,
  GetAbsenceRequestByIdUseCase,
  GetAbsenceRequestsUseCase,
  GetMyAbsenceRequestsUseCase,
  ReviewAbsenceRequestUseCase,
} from "@/application/absence-request";
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
  AbsenceRequestResponse,
  CreateAbsenceRequestRequest,
  ListAbsenceRequestsQuery,
  ReviewAbsenceRequestRequest,
} from "../dtos/absence-request";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../guards/hydrate-current-user.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

const ABSENCE_REQUEST_ALLOWED_SORT_FIELDS = [
  "createdAt",
  "startDate",
  "updatedAt",
];

const ABSENCE_REQUEST_ALLOWED_FILTER_FIELDS = [
  "status",
  "studentId",
  "requesterGuardianId",
  "createdAt",
  "updatedAt",
  "startDate",
  "endDate",
];

@ApiTags("Absence Requests")
@ApiBearerAuth("JWT")
@Controller("absence-requests")
@UseGuards(ClerkAuthGuard)
export class AbsenceRequestController {
  constructor(
    private readonly createAbsenceRequestUseCase: CreateAbsenceRequestUseCase,
    private readonly getAbsenceRequestByIdUseCase: GetAbsenceRequestByIdUseCase,
    private readonly getAbsenceRequestsUseCase: GetAbsenceRequestsUseCase,
    private readonly getMyAbsenceRequestsUseCase: GetMyAbsenceRequestsUseCase,
    private readonly reviewAbsenceRequestUseCase: ReviewAbsenceRequestUseCase,
  ) {}

  @Post()
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Absence request submitted successfully",
    type: AbsenceRequestResponse,
  })
  @ApiOperation({
    summary: "Submit an absence request",
    description:
      "Allows the authenticated guardian to submit an absence request for one of their active students in the selected campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the absence request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiForbiddenResponse({
    description: "Current user is not linked to the requested student.",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateAbsenceRequestRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.createAbsenceRequestUseCase.execute(campusId, currentUser, dto);
  }

  @Get("mine")
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Absence request history retrieved successfully",
    type: AbsenceRequestResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "List my absence requests",
    description:
      "Returns absence requests submitted by the authenticated guardian in the selected campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the absence request history",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getMine(
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    return this.getMyAbsenceRequestsUseCase.execute(campusId, currentUser);
  }

  @Get()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("absence_request.list")
  @StandardResponse({
    message: "Absence requests retrieved successfully",
    type: AbsenceRequestResponse,
    isPaginated: true,
    allowedSortFields: ABSENCE_REQUEST_ALLOWED_SORT_FIELDS,
    allowedFilterFields: ABSENCE_REQUEST_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List campus absence requests",
    description:
      "Lists campus absence requests with standard pagination, filtering, sorting, and an overlapsDate convenience filter.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the absence request list",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: ListAbsenceRequestsQuery,
  ) {
    return this.getAbsenceRequestsUseCase.execute(campusId, query);
  }

  @Get(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("absence_request.read")
  @StandardResponse({
    message: "Absence request retrieved successfully",
    type: AbsenceRequestResponse,
  })
  @ApiOperation({ summary: "Get an absence request by ID" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the absence request lookup",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Absence request ID",
    type: "string",
    format: "uuid",
  })
  async findOne(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.getAbsenceRequestByIdUseCase.execute(campusId, id);
  }

  @Patch(":id/review")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("absence_request.update")
  @StandardResponse({
    message: "Absence request reviewed successfully",
    type: AbsenceRequestResponse,
  })
  @ApiOperation({ summary: "Approve or deny an absence request" })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the absence request review",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Absence request ID",
    type: "string",
    format: "uuid",
  })
  async review(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewAbsenceRequestRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.reviewAbsenceRequestUseCase.execute(
      campusId,
      id,
      dto,
      currentUser,
    );
  }
}
