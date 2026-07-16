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
  CancelMedicationRequestUseCase,
  CreateMedicationRequestUseCase,
  GetMyMedicationRequestByIdUseCase,
  GetMyMedicationRequestsUseCase,
  RespondMedicationRequestUseCase,
} from "@/application/medication";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../decorators";
import {
  CancelMedicationRequestRequest,
  CreateMedicationRequestRequest,
  ListMedicationRequestsQuery,
  MedicationRequestResponse,
  ParentMedicationRequestDetailResponse,
  RespondMedicationRequestRequest,
} from "../dtos/medication";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../guards/hydrate-current-user.guard";

@ApiTags("Parent Medication Requests")
@ApiBearerAuth("JWT")
@Controller("parent/medication-requests")
@UseGuards(ClerkAuthGuard)
export class ParentMedicationRequestController {
  constructor(
    private readonly createMedicationRequestUseCase: CreateMedicationRequestUseCase,
    private readonly getMyMedicationRequestsUseCase: GetMyMedicationRequestsUseCase,
    private readonly getMyMedicationRequestByIdUseCase: GetMyMedicationRequestByIdUseCase,
    private readonly cancelMedicationRequestUseCase: CancelMedicationRequestUseCase,
    private readonly respondMedicationRequestUseCase: RespondMedicationRequestUseCase,
  ) {}

  @Get()
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Medication request history retrieved successfully",
    type: MedicationRequestResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "List my medication requests",
    description:
      "Returns medication requests submitted by the authenticated guardian in the selected campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the medication request history",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getMine(
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
    @Query() query: ListMedicationRequestsQuery,
  ) {
    return this.getMyMedicationRequestsUseCase.execute(
      campusId,
      currentUser,
      query,
    );
  }

  @Post()
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Medication request submitted successfully",
    type: MedicationRequestResponse,
  })
  @ApiOperation({
    summary: "Submit a medication request",
    description:
      "Allows the authenticated guardian to submit a medication request for one of their active students in the selected campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the medication request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiForbiddenResponse({
    description: "Current user is not linked to the requested student.",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateMedicationRequestRequest,
    @CurrentUser() currentUser: User,
  ) {
    return this.createMedicationRequestUseCase.execute(
      campusId,
      currentUser,
      dto,
    );
  }

  @Get(":requestId")
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Medication request retrieved successfully",
    type: ParentMedicationRequestDetailResponse,
  })
  @ApiOperation({
    summary: "Get my medication request",
    description:
      "Returns a single medication request only when it belongs to the authenticated guardian in the selected campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the medication request lookup",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "requestId",
    description: "Medication request ID",
    type: "string",
    format: "uuid",
  })
  @ApiNotFoundResponse({
    description:
      "Medication request was not found for the authenticated guardian in the selected campus.",
  })
  async findOne(
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
    @Param("requestId", ParseUUIDPipe) requestId: string,
  ) {
    return this.getMyMedicationRequestByIdUseCase.execute(
      campusId,
      currentUser,
      requestId,
    );
  }

  @Post(":requestId/cancel")
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Medication request cancelled successfully",
    type: MedicationRequestResponse,
  })
  @ApiOperation({
    summary: "Cancel my medication request",
    description:
      "Cancels a guardian-owned request while submitted or waiting for more information. Terminal requests and requests at or beyond their campus-local expiration boundary return conflict; a late active request is first persisted as EXPIRED.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the medication request cancellation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "requestId",
    description: "Medication request ID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description: "Invalid cancellation reason or non-terminal workflow state.",
  })
  @ApiConflictResponse({
    description:
      "The request is terminal or reached its campus-local expiration boundary.",
  })
  @ApiNotFoundResponse({
    description:
      "Medication request was not found for the authenticated guardian in the selected campus.",
  })
  async cancel(
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: CancelMedicationRequestRequest,
  ) {
    return this.cancelMedicationRequestUseCase.execute(
      campusId,
      currentUser,
      requestId,
      dto,
    );
  }

  @Post(":requestId/respond")
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Medication request response submitted successfully",
    type: MedicationRequestResponse,
  })
  @ApiOperation({
    summary: "Respond to a medication request information request",
    description:
      "Adds parent follow-up information when staff requested more information. Terminal requests and requests at or beyond their campus-local expiration boundary return conflict; a late active request is first persisted as EXPIRED.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the medication request response",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "requestId",
    description: "Medication request ID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description: "Missing response message or non-terminal workflow state.",
  })
  @ApiConflictResponse({
    description:
      "The request is terminal or reached its campus-local expiration boundary.",
  })
  @ApiNotFoundResponse({
    description:
      "Medication request was not found for the authenticated guardian in the selected campus.",
  })
  async respond(
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
    @Param("requestId", ParseUUIDPipe) requestId: string,
    @Body() dto: RespondMedicationRequestRequest,
  ) {
    return this.respondMedicationRequestUseCase.execute(
      campusId,
      currentUser,
      requestId,
      dto,
    );
  }
}
