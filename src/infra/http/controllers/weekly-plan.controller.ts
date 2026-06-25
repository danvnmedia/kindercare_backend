import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import {
  ActiveWeeklyPlanResult,
  ArchiveWeeklyPlanUseCase,
  CopyWeeklyPlanInput,
  CopyWeeklyPlanResult,
  CopyWeeklyPlanUseCase,
  CreateWeeklyPlanInput,
  CreateWeeklyPlanResult,
  CreateWeeklyPlanUseCase,
  GetActiveWeeklyPlanUseCase,
  GetWeeklyPlanByIdUseCase,
  GetWeeklyPlansInput,
  GetWeeklyPlansUseCase,
  RestoreWeeklyPlanUseCase,
  UpdateWeeklyPlanInput,
  UpdateWeeklyPlanUseCase,
} from "@/application/weekly-plan";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { WeeklyPlan } from "@/domain/weekly-plan";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  ActiveWeeklyPlanQuery,
  ActiveWeeklyPlanResponse,
  CopyWeeklyPlanRequest,
  CopyWeeklyPlanResponse,
  CreateWeeklyPlanRequest,
  CreateWeeklyPlanResponse,
  ListWeeklyPlansQuery,
  UpdateWeeklyPlanRequest,
  WeeklyPlanResponse,
} from "../dtos/weekly-plan";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

const WEEKLY_PLAN_ALLOWED_SORT_FIELDS = [
  "weekStartDate",
  "createdAt",
  "updatedAt",
];

const WEEKLY_PLAN_ALLOWED_FILTER_FIELDS = [
  "classId",
  "weekStartDate",
  "isArchived",
  "createdAt",
  "updatedAt",
];

@ApiTags("Weekly Plans")
@ApiBearerAuth("JWT")
@Controller("weekly-plans")
@UseGuards(ClerkAuthGuard)
export class WeeklyPlanController {
  constructor(
    private readonly archiveWeeklyPlanUseCase: ArchiveWeeklyPlanUseCase,
    private readonly copyWeeklyPlanUseCase: CopyWeeklyPlanUseCase,
    private readonly createWeeklyPlanUseCase: CreateWeeklyPlanUseCase,
    private readonly getActiveWeeklyPlanUseCase: GetActiveWeeklyPlanUseCase,
    private readonly getWeeklyPlanByIdUseCase: GetWeeklyPlanByIdUseCase,
    private readonly getWeeklyPlansUseCase: GetWeeklyPlansUseCase,
    private readonly restoreWeeklyPlanUseCase: RestoreWeeklyPlanUseCase,
    private readonly updateWeeklyPlanUseCase: UpdateWeeklyPlanUseCase,
  ) {}

  @Get()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.list")
  @StandardResponse({
    message: "Weekly plans retrieved successfully",
    type: WeeklyPlanResponse,
    isPaginated: true,
    allowedSortFields: WEEKLY_PLAN_ALLOWED_SORT_FIELDS,
    allowedFilterFields: WEEKLY_PLAN_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List weekly plans",
    description:
      "Lists active-campus weekly plans with standard pagination, sorting, and filtering. Archived plans are excluded by default unless the standard isArchived filter is supplied.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.list permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: ListWeeklyPlansQuery,
  ): Promise<PaginatedResult<WeeklyPlan>> {
    return this.getWeeklyPlansUseCase.execute(this.toListInput(campusId, query));
  }

  @Get("active")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.read")
  @StandardResponse({
    message: "Active weekly plan retrieved successfully",
    type: ActiveWeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Get active weekly plan for a class and week",
    description:
      "Looks up the exact active weekly plan for one class and one Monday week. Returns plan: null when the class/week is valid but no active plan exists.",
  })
  @ApiBadRequestResponse({
    description: "Invalid classId or weekStartDate query.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.read permission.",
  })
  @ApiNotFoundResponse({
    description: "The requested class was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiQuery({
    name: "classId",
    required: true,
    description: "Class UUID used for exact active lookup.",
  })
  @ApiQuery({
    name: "weekStartDate",
    required: true,
    description:
      "Monday calendar anchor for the weekly plan. Date-only strings or ISO datetimes are accepted.",
  })
  async findActive(
    @CampusContext() campusId: string,
    @Query() query: ActiveWeeklyPlanQuery,
  ): Promise<ActiveWeeklyPlanResult> {
    return this.getActiveWeeklyPlanUseCase.execute({
      campusId,
      classId: query.classId,
      weekStartDate: new Date(query.weekStartDate),
    });
  }

  @Get(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.read")
  @StandardResponse({
    message: "Weekly plan retrieved successfully",
    type: WeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Get weekly plan by ID",
    description:
      "Retrieves one campus-scoped weekly plan with class context and flat schedule blocks, including archived plans for authorized read callers.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Weekly plan was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({ name: "id", description: "Weekly plan UUID" })
  async findById(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ): Promise<WeeklyPlan> {
    return this.getWeeklyPlanByIdUseCase.execute(campusId, id);
  }

  @Post()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.create")
  @StandardResponse({
    message: "Weekly plans created successfully",
    type: CreateWeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Create weekly plans",
    description:
      "Creates independent active weekly plans for one or more active-campus classes. campusId is resolved from campus context, never from the request body.",
  })
  @ApiBody({ type: CreateWeeklyPlanRequest })
  @ApiBadRequestResponse({
    description:
      "Invalid/non-Monday weekStartDate, duplicate classIds, invalid theme, or invalid block/activity payload.",
  })
  @ApiConflictResponse({
    description:
      "A concurrent duplicate create prevented persistence for the requested class/week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.create permission.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateWeeklyPlanRequest,
    @CurrentUser() currentUser: User,
  ): Promise<CreateWeeklyPlanResult> {
    return this.createWeeklyPlanUseCase.execute(
      this.toCreateInput(campusId, dto),
      currentUser,
    );
  }

  @Delete(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.delete")
  @StandardResponse({
    message: "Weekly plan archived successfully",
    type: WeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Archive weekly plan",
    description:
      "Soft-archives a campus-scoped weekly plan. Archived plans are hidden from default list results and no longer block a replacement active weekly plan.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.delete permission.",
  })
  @ApiNotFoundResponse({
    description: "Weekly plan was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({ name: "id", description: "Weekly plan UUID" })
  async archive(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ): Promise<WeeklyPlan> {
    return this.archiveWeeklyPlanUseCase.execute(campusId, id, currentUser);
  }

  @Patch(":id/restore")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.update")
  @StandardResponse({
    message: "Weekly plan restored successfully",
    type: WeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Restore archived weekly plan",
    description:
      "Restores an archived campus-scoped weekly plan when no active weekly plan already exists for the same campus, class, and week.",
  })
  @ApiBadRequestResponse({
    description: "The weekly plan is already active and cannot be restored.",
  })
  @ApiConflictResponse({
    description:
      "An active weekly plan already exists for this campus, class, and week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.update permission.",
  })
  @ApiNotFoundResponse({
    description: "Weekly plan was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({ name: "id", description: "Weekly plan UUID" })
  async restore(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ): Promise<WeeklyPlan> {
    return this.restoreWeeklyPlanUseCase.execute(campusId, id, currentUser);
  }

  @Post(":id/copy")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.create")
  @StandardResponse({
    message: "Weekly plans copied successfully",
    type: CopyWeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Copy weekly plan",
    description:
      "Copies an active source weekly plan into one or more destination classes and a destination week. The copied plans preserve source blocks and activities, preserve the source theme by default, and support theme override or clear.",
  })
  @ApiBody({ type: CopyWeeklyPlanRequest })
  @ApiBadRequestResponse({
    description:
      "Invalid/non-Monday weekStartDate, duplicate classIds, invalid theme, or archived source plan.",
  })
  @ApiConflictResponse({
    description:
      "A concurrent duplicate copy prevented persistence for the requested class/week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.create permission.",
  })
  @ApiNotFoundResponse({
    description: "Source weekly plan was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({ name: "id", description: "Source weekly plan UUID" })
  async copy(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: CopyWeeklyPlanRequest,
    @CurrentUser() currentUser: User,
  ): Promise<CopyWeeklyPlanResult> {
    return this.copyWeeklyPlanUseCase.execute(
      id,
      this.toCopyInput(campusId, dto),
      currentUser,
    );
  }

  @Patch(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("weekly_plan.update")
  @StandardResponse({
    message: "Weekly plan updated successfully",
    type: WeeklyPlanResponse,
  })
  @ApiOperation({
    summary: "Update weekly plan",
    description:
      "Updates one active campus-scoped weekly plan and replaces the stored schedule blocks in one save operation when blocks are supplied. Archived plans must be restored before update.",
  })
  @ApiBody({ type: UpdateWeeklyPlanRequest })
  @ApiBadRequestResponse({
    description:
      "Archived plan mutation, invalid/non-Monday weekStartDate, invalid theme, or invalid block/activity payload.",
  })
  @ApiConflictResponse({
    description:
      "An active weekly plan already exists for this campus, class, and week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and weekly_plan.update permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Weekly plan or destination class was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({ name: "id", description: "Weekly plan UUID" })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateWeeklyPlanRequest,
    @CurrentUser() currentUser: User,
  ): Promise<WeeklyPlan> {
    return this.updateWeeklyPlanUseCase.execute(
      id,
      this.toUpdateInput(campusId, dto),
      currentUser,
    );
  }

  private toListInput(
    campusId: string,
    query: ListWeeklyPlansQuery,
  ): GetWeeklyPlansInput {
    return {
      campusId,
      params: query,
    };
  }

  private toCreateInput(
    campusId: string,
    dto: CreateWeeklyPlanRequest,
  ): CreateWeeklyPlanInput {
    return {
      campusId,
      classIds: dto.classIds,
      weekStartDate: new Date(dto.weekStartDate),
      theme: dto.theme,
      blocks: dto.blocks,
    };
  }

  private toCopyInput(
    campusId: string,
    dto: CopyWeeklyPlanRequest,
  ): CopyWeeklyPlanInput {
    return {
      campusId,
      classIds: dto.classIds,
      weekStartDate: new Date(dto.weekStartDate),
      theme: dto.theme,
    };
  }

  private toUpdateInput(
    campusId: string,
    dto: UpdateWeeklyPlanRequest,
  ): UpdateWeeklyPlanInput {
    return {
      campusId,
      ...(dto.classId !== undefined ? { classId: dto.classId } : {}),
      ...(dto.weekStartDate !== undefined
        ? { weekStartDate: new Date(dto.weekStartDate) }
        : {}),
      ...(dto.theme !== undefined ? { theme: dto.theme } : {}),
      ...(dto.blocks !== undefined ? { blocks: dto.blocks } : {}),
    };
  }
}
