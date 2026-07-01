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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";

import { GetStudentMedicationHistoryUseCase } from "@/application/medication";
import {
  CreateStudentHealthCheckupUseCase,
  CreateStudentHealthEventUseCase,
  CreateStudentHealthInstructionUseCase,
  GetActiveStudentHealthInstructionsUseCase,
  GetStudentHealthCheckupByIdUseCase,
  GetStudentHealthCheckupsUseCase,
  GetStudentHealthEventByIdUseCase,
  GetStudentHealthEventsUseCase,
  GetStudentHealthInstructionByIdUseCase,
  GetStudentHealthInstructionsUseCase,
  GetStudentHealthProfileUseCase,
  UpdateStudentHealthCheckupUseCase,
  UpdateStudentHealthEventUseCase,
  UpdateStudentHealthInstructionUseCase,
  UpdateStudentHealthProfileUseCase,
} from "@/application/student-health";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { MedicationRequest } from "@/domain/medication";
import {
  StudentHealthCheckup,
  StudentHealthEvent,
  StudentHealthInstruction,
  StudentHealthProfile,
} from "@/domain/student-health";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  ListStudentMedicationHistoryQuery,
  MedicationRequestDetailResponse,
} from "../dtos/medication";
import {
  ActiveHealthInstructionsQuery,
  ActiveStudentHealthInstructionsResponseDto,
  CreateStudentHealthCheckupRequest,
  CreateStudentHealthEventRequest,
  CreateStudentHealthInstructionRequest,
  ListStudentHealthCheckupsQuery,
  ListStudentHealthEventsQuery,
  ListStudentHealthInstructionsQuery,
  StudentHealthCheckupResponse,
  StudentHealthEventResponse,
  StudentHealthInstructionResponse,
  StudentHealthProfileResponse,
  UpdateStudentHealthCheckupRequest,
  UpdateStudentHealthEventRequest,
  UpdateStudentHealthInstructionRequest,
  UpdateStudentHealthProfileRequest,
} from "../dtos/student-health";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

const HEALTH_CHECKUP_ALLOWED_SORT_FIELDS = [
  "checkupType",
  "checkedAt",
  "heightCm",
  "weightKg",
  "createdAt",
  "updatedAt",
];

const HEALTH_CHECKUP_ALLOWED_FILTER_FIELDS = [
  "checkupType",
  "checkedAt",
  "heightCm",
  "weightKg",
  "createdAt",
  "updatedAt",
];

const HEALTH_EVENT_ALLOWED_SORT_FIELDS = [
  "eventType",
  "category",
  "title",
  "occurredAt",
  "status",
  "createdAt",
  "updatedAt",
];

const HEALTH_EVENT_ALLOWED_FILTER_FIELDS = [
  "eventType",
  "category",
  "title",
  "description",
  "occurredAt",
  "status",
  "resolutionNotes",
  "createdAt",
  "updatedAt",
];

const HEALTH_INSTRUCTION_ALLOWED_SORT_FIELDS = [
  "instructionType",
  "title",
  "startDate",
  "endDate",
  "isActive",
  "createdAt",
  "updatedAt",
];

const HEALTH_INSTRUCTION_ALLOWED_FILTER_FIELDS = [
  "instructionType",
  "title",
  "instruction",
  "dosage",
  "startDate",
  "endDate",
  "timesOfDay",
  "scheduleNotes",
  "notes",
  "isActive",
  "createdAt",
  "updatedAt",
];

@ApiTags("Student Health")
@ApiBearerAuth("JWT")
@Controller("students")
@UseGuards(ClerkAuthGuard)
export class StudentHealthController {
  constructor(
    private readonly createCheckupUseCase: CreateStudentHealthCheckupUseCase,
    private readonly createEventUseCase: CreateStudentHealthEventUseCase,
    private readonly createInstructionUseCase: CreateStudentHealthInstructionUseCase,
    private readonly getActiveStudentInstructionsUseCase: GetActiveStudentHealthInstructionsUseCase,
    private readonly getCheckupByIdUseCase: GetStudentHealthCheckupByIdUseCase,
    private readonly getCheckupsUseCase: GetStudentHealthCheckupsUseCase,
    private readonly getEventByIdUseCase: GetStudentHealthEventByIdUseCase,
    private readonly getEventsUseCase: GetStudentHealthEventsUseCase,
    private readonly getInstructionByIdUseCase: GetStudentHealthInstructionByIdUseCase,
    private readonly getInstructionsUseCase: GetStudentHealthInstructionsUseCase,
    private readonly getStudentMedicationHistoryUseCase: GetStudentMedicationHistoryUseCase,
    private readonly getProfileUseCase: GetStudentHealthProfileUseCase,
    private readonly updateCheckupUseCase: UpdateStudentHealthCheckupUseCase,
    private readonly updateEventUseCase: UpdateStudentHealthEventUseCase,
    private readonly updateInstructionUseCase: UpdateStudentHealthInstructionUseCase,
    private readonly updateProfileUseCase: UpdateStudentHealthProfileUseCase,
  ) {}

  @Get(":studentId/health-profile")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health profile retrieved successfully",
    type: StudentHealthProfileResponse,
  })
  @ApiOperation({
    summary: "Get student health profile",
    description:
      "Returns the selected-campus health profile snapshot, creating a stable empty profile shape when none exists.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async getProfile(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
  ): Promise<StudentHealthProfile> {
    return this.getProfileUseCase.execute({ campusId, studentId });
  }

  @Patch(":studentId/health-profile")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.update")
  @StandardResponse({
    message: "Student health profile updated successfully",
    type: StudentHealthProfileResponse,
  })
  @ApiOperation({
    summary: "Update student health profile",
    description:
      "Updates structured allergies, conditions, restrictions, and emergency notes for the selected-campus student health profile.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, empty patch, invalid enum, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.update permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async updateProfile(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: UpdateStudentHealthProfileRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthProfile> {
    return this.updateProfileUseCase.execute(
      campusId,
      studentId,
      dto,
      currentUser,
    );
  }

  @Get(":studentId/medication-history")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("medication_request.read")
  @StandardResponse({
    message: "Student medication history retrieved successfully",
    type: MedicationRequestDetailResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "List student medication history",
    description:
      "Returns selected-campus medication requests and administration history for one student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced medication scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description:
      "Requires campus access and medication_request.read permission.",
  })
  async listMedicationHistory(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Query() query: ListStudentMedicationHistoryQuery,
  ): Promise<PaginatedResult<MedicationRequest>> {
    return this.getStudentMedicationHistoryUseCase.execute(
      campusId,
      studentId,
      query,
    );
  }

  @Get(":studentId/health-checkups")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health checkups retrieved successfully",
    type: StudentHealthCheckupResponse,
    isPaginated: true,
    allowedSortFields: HEALTH_CHECKUP_ALLOWED_SORT_FIELDS,
    allowedFilterFields: HEALTH_CHECKUP_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List student health checkups",
    description:
      "Lists selected-campus health checkup records for one student using standard pagination, sorting, and filtering.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async listCheckups(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Query() query: ListStudentHealthCheckupsQuery,
  ): Promise<PaginatedResult<StudentHealthCheckup>> {
    return this.getCheckupsUseCase.execute({
      campusId,
      studentId,
      params: query,
    });
  }

  @Post(":studentId/health-checkups")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.create")
  @StandardResponse({
    message: "Student health checkup created successfully",
    type: StudentHealthCheckupResponse,
  })
  @ApiOperation({
    summary: "Create student health checkup",
    description:
      "Creates one selected-campus health checkup record for a student. BMI and percentile fields are not part of the V1 contract.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, missing checkedAt, future checkedAt, non-positive metric, missing meaningful value, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.create permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async createCheckup(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentHealthCheckupRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthCheckup> {
    return this.createCheckupUseCase.execute(
      campusId,
      studentId,
      dto,
      currentUser,
    );
  }

  @Get(":studentId/health-checkups/:checkupId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health checkup retrieved successfully",
    type: StudentHealthCheckupResponse,
  })
  @ApiOperation({
    summary: "Get student health checkup",
    description:
      "Returns one selected-campus health checkup record for the requested student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "checkupId",
    description: "Health checkup UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Student was not found in the selected campus, or checkup was not found for the student.",
  })
  async getCheckup(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("checkupId", ParseUUIDPipe) checkupId: string,
  ): Promise<StudentHealthCheckup> {
    return this.getCheckupByIdUseCase.execute({
      campusId,
      studentId,
      checkupId,
    });
  }

  @Patch(":studentId/health-checkups/:checkupId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.update")
  @StandardResponse({
    message: "Student health checkup updated successfully",
    type: StudentHealthCheckupResponse,
  })
  @ApiOperation({
    summary: "Update student health checkup",
    description:
      "Updates one selected-campus health checkup record. V1 supports updates but no delete/archive endpoint.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "checkupId",
    description: "Health checkup UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, empty patch, future checkedAt, non-positive metric, missing meaningful value, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.update permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Student was not found in the selected campus, or checkup was not found for the student.",
  })
  async updateCheckup(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("checkupId", ParseUUIDPipe) checkupId: string,
    @Body() dto: UpdateStudentHealthCheckupRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthCheckup> {
    return this.updateCheckupUseCase.execute(
      campusId,
      studentId,
      checkupId,
      dto,
      currentUser,
    );
  }

  @Get(":studentId/health-events")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health events retrieved successfully",
    type: StudentHealthEventResponse,
    isPaginated: true,
    allowedSortFields: HEALTH_EVENT_ALLOWED_SORT_FIELDS,
    allowedFilterFields: HEALTH_EVENT_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List student health events",
    description:
      "Lists selected-campus manual health history events for one student using standard pagination, sorting, filtering, and optional status/eventType filters.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async listEvents(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Query() query: ListStudentHealthEventsQuery,
  ): Promise<PaginatedResult<StudentHealthEvent>> {
    return this.getEventsUseCase.execute({
      campusId,
      studentId,
      params: query,
    });
  }

  @Post(":studentId/health-events")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.create")
  @StandardResponse({
    message: "Student health event created successfully",
    type: StudentHealthEventResponse,
  })
  @ApiOperation({
    summary: "Create student health event",
    description:
      "Creates one selected-campus manual health history event for a student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, missing required field, future occurredAt, invalid status/type/category, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.create permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async createEvent(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentHealthEventRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthEvent> {
    return this.createEventUseCase.execute(
      campusId,
      studentId,
      dto,
      currentUser,
    );
  }

  @Get(":studentId/health-events/:eventId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health event retrieved successfully",
    type: StudentHealthEventResponse,
  })
  @ApiOperation({
    summary: "Get student health event",
    description:
      "Returns one selected-campus manual health history event for the requested student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "eventId",
    description: "Health event UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Student was not found in the selected campus, or event was not found for the student.",
  })
  async getEvent(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
  ): Promise<StudentHealthEvent> {
    return this.getEventByIdUseCase.execute({
      campusId,
      studentId,
      eventId,
    });
  }

  @Patch(":studentId/health-events/:eventId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.update")
  @StandardResponse({
    message: "Student health event updated successfully",
    type: StudentHealthEventResponse,
  })
  @ApiOperation({
    summary: "Update student health event",
    description:
      "Updates one selected-campus manual health history event. ARCHIVED is a readable status, not deletion.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "eventId",
    description: "Health event UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, empty patch, future occurredAt, invalid status/type/category, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.update permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Student was not found in the selected campus, or event was not found for the student.",
  })
  async updateEvent(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateStudentHealthEventRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthEvent> {
    return this.updateEventUseCase.execute(
      campusId,
      studentId,
      eventId,
      dto,
      currentUser,
    );
  }

  @Get(":studentId/health-instructions")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health instructions retrieved successfully",
    type: StudentHealthInstructionResponse,
    isPaginated: true,
    allowedSortFields: HEALTH_INSTRUCTION_ALLOWED_SORT_FIELDS,
    allowedFilterFields: HEALTH_INSTRUCTION_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List student health instructions",
    description:
      "Lists selected-campus health instructions for one student using standard pagination, sorting, filtering, and optional derived status filtering.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async listInstructions(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Query() query: ListStudentHealthInstructionsQuery,
  ): Promise<PaginatedResult<StudentHealthInstructionResponseShape>> {
    const result = await this.getInstructionsUseCase.execute({
      campusId,
      studentId,
      params: query,
    });

    return {
      ...result,
      data: result.data.map((instruction) =>
        toInstructionResponse(instruction, query.date),
      ),
    };
  }

  @Post(":studentId/health-instructions")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.create")
  @StandardResponse({
    message: "Student health instruction created successfully",
    type: StudentHealthInstructionResponse,
  })
  @ApiOperation({
    summary: "Create student health instruction",
    description:
      "Creates one selected-campus medication, care, diet, activity, or other instruction for a student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, missing required field, invalid date range, invalid schedule, unknown status field, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.create permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async createInstruction(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentHealthInstructionRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthInstructionResponseShape> {
    const instruction = await this.createInstructionUseCase.execute(
      campusId,
      studentId,
      dto,
      currentUser,
    );
    return toInstructionResponse(instruction);
  }

  @Get(":studentId/health-instructions/active")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Active student health instructions retrieved successfully",
    type: ActiveStudentHealthInstructionsResponseDto,
  })
  @ApiOperation({
    summary: "Get active student health instructions",
    description:
      "Returns only active instructions for one student and reference date. This read creates no administration events and no audit row.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Student was not found in the selected campus.",
  })
  async getActiveStudentInstructions(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Query() query: ActiveHealthInstructionsQuery,
  ) {
    return this.getActiveStudentInstructionsUseCase.execute({
      campusId,
      studentId,
      date: query.date,
    });
  }

  @Get(":studentId/health-instructions/:instructionId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.read")
  @StandardResponse({
    message: "Student health instruction retrieved successfully",
    type: StudentHealthInstructionResponse,
  })
  @ApiOperation({
    summary: "Get student health instruction",
    description:
      "Returns one selected-campus health instruction for the requested student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "instructionId",
    description: "Health instruction UUID",
    type: "string",
    format: "uuid",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.read permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Student was not found in the selected campus, or instruction was not found for the student.",
  })
  async getInstruction(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("instructionId", ParseUUIDPipe) instructionId: string,
  ): Promise<StudentHealthInstructionResponseShape> {
    const instruction = await this.getInstructionByIdUseCase.execute({
      campusId,
      studentId,
      instructionId,
    });
    return toInstructionResponse(instruction);
  }

  @Patch(":studentId/health-instructions/:instructionId")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("student_health.update")
  @StandardResponse({
    message: "Student health instruction updated successfully",
    type: StudentHealthInstructionResponse,
  })
  @ApiOperation({
    summary: "Update student health instruction",
    description:
      "Updates one selected-campus health instruction. V1 supports updates but no delete/archive endpoint.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID used as the system-enforced health data scope.",
  })
  @ApiParam({
    name: "studentId",
    description: "Student UUID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "instructionId",
    description: "Health instruction UUID",
    type: "string",
    format: "uuid",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid payload, empty patch, invalid date range, invalid schedule, unknown status field, or archived student write.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and student_health.update permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Student was not found in the selected campus, or instruction was not found for the student.",
  })
  async updateInstruction(
    @CampusContext() campusId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Param("instructionId", ParseUUIDPipe) instructionId: string,
    @Body() dto: UpdateStudentHealthInstructionRequest,
    @CurrentUser() currentUser: User,
  ): Promise<StudentHealthInstructionResponseShape> {
    const instruction = await this.updateInstructionUseCase.execute(
      campusId,
      studentId,
      instructionId,
      dto,
      currentUser,
    );
    return toInstructionResponse(instruction);
  }
}

type StudentHealthInstructionResponseShape = Omit<
  StudentHealthInstructionResponse,
  "startDate" | "endDate"
> & {
  startDate: Date;
  endDate: Date | null;
};

function toInstructionResponse(
  instruction: StudentHealthInstruction,
  referenceDate?: string,
): StudentHealthInstructionResponseShape {
  return {
    id: instruction.id,
    studentId: instruction.studentId,
    campusId: instruction.campusId,
    instructionType: instruction.instructionType,
    title: instruction.title,
    instruction: instruction.instruction,
    dosage: instruction.dosage,
    startDate: instruction.startDate,
    endDate: instruction.endDate,
    timesOfDay: instruction.timesOfDay,
    scheduleNotes: instruction.scheduleNotes,
    notes: instruction.notes,
    isActive: instruction.isActive,
    status: instruction.getStatus(referenceDate ?? new Date()),
    createdBy: instruction.createdBy,
    lastUpdatedBy: instruction.lastUpdatedBy,
    createdAt: instruction.createdAt,
    updatedAt: instruction.updatedAt,
  };
}
