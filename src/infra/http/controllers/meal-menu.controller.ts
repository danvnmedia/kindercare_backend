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
  ArchiveMealMenuUseCase,
  CopyMealMenuInput,
  CopyMealMenuUseCase,
  CreateMealMenuInput,
  CreateMealMenuUseCase,
  EffectiveClassMealMenuResult,
  GetEffectiveClassMealMenuUseCase,
  GetMealMenuByIdUseCase,
  GetMealMenusInput,
  GetMealMenusUseCase,
  RestoreMealMenuUseCase,
  UpdateMealMenuInput,
  UpdateMealMenuUseCase,
} from "@/application/meal-menu";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";
import { StandardResponse } from "@/core/modules/standard-response/decorators";
import { MealMenu } from "@/domain/meal-menu";
import { User } from "@/domain/user-management/user.entity";

import {
  CAMPUS_ID_HEADER,
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
} from "../decorators";
import { Permissions } from "../decorators/permissions.decorator";
import {
  CopyMealMenuRequest,
  CreateMealMenuRequest,
  EffectiveClassMealMenuQuery,
  EffectiveClassMealMenuResponse,
  ListMealMenusQuery,
  MealMenuResponse,
  UpdateMealMenuRequest,
} from "../dtos/meal-menu";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { PermissionsGuard } from "../guards/permissions.guard";

const MEAL_MENU_ALLOWED_SORT_FIELDS = [
  "weekStartDate",
  "createdAt",
  "updatedAt",
];

const MEAL_MENU_ALLOWED_FILTER_FIELDS = [
  "weekStartDate",
  "isArchived",
  "createdAt",
  "updatedAt",
];

@ApiTags("Meal Menus")
@ApiBearerAuth("JWT")
@Controller("meal-menus")
@UseGuards(ClerkAuthGuard)
export class MealMenuController {
  constructor(
    private readonly getMealMenusUseCase: GetMealMenusUseCase,
    private readonly getEffectiveClassMealMenuUseCase: GetEffectiveClassMealMenuUseCase,
    private readonly getMealMenuByIdUseCase: GetMealMenuByIdUseCase,
    private readonly archiveMealMenuUseCase: ArchiveMealMenuUseCase,
    private readonly copyMealMenuUseCase: CopyMealMenuUseCase,
    private readonly createMealMenuUseCase: CreateMealMenuUseCase,
    private readonly restoreMealMenuUseCase: RestoreMealMenuUseCase,
    private readonly updateMealMenuUseCase: UpdateMealMenuUseCase,
  ) {}

  @Get()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.list")
  @StandardResponse({
    message: "Meal menus retrieved successfully",
    type: MealMenuResponse,
    isPaginated: true,
    allowedSortFields: MEAL_MENU_ALLOWED_SORT_FIELDS,
    allowedFilterFields: MEAL_MENU_ALLOWED_FILTER_FIELDS,
  })
  @ApiOperation({
    summary: "List meal menus",
    description:
      "Lists campus-scoped meal menus with standard pagination, sorting, and filtering. Requires meal_menu.list permission. Archived menus are excluded by default unless the standard isArchived filter is supplied. Allowed filter fields are weekStartDate, isArchived, createdAt, and updatedAt. Default sort is weekStartDate descending. Target filtering uses dedicated query params, not campusId in the request body. Target filters are exact and do not perform fallback lookup.",
  })
  @ApiBadRequestResponse({
    description:
      "Invalid target query, missing required target id, or target id supplied with the wrong target.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.list permission.",
  })
  @ApiNotFoundResponse({
    description:
      "The requested gradeLevelId or classId was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiQuery({
    name: "target",
    required: false,
    enum: ["all", "campus", "grade", "class"],
    description:
      "Target scope: omit/all returns all targets, campus returns whole-campus menus, grade requires gradeLevelId, class requires classId.",
  })
  @ApiQuery({
    name: "gradeLevelId",
    required: false,
    description:
      "Grade level UUID used only when target=grade. Supplying it with target=campus, target=class, or target=all is rejected.",
  })
  @ApiQuery({
    name: "classId",
    required: false,
    description:
      "Class UUID used only when target=class. Supplying it with target=campus, target=grade, or target=all is rejected.",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: ListMealMenusQuery,
  ): Promise<PaginatedResult<MealMenu>> {
    return this.getMealMenusUseCase.execute(this.toListInput(campusId, query));
  }

  @Get("effective")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.read")
  @StandardResponse({
    message: "Effective meal menu retrieved successfully",
    type: EffectiveClassMealMenuResponse,
  })
  @ApiOperation({
    summary: "Get effective meal menu for a class and week",
    description:
      "Resolves the active effective meal menu for a class and week by checking an exact class menu first, then the class grade menu, then the whole-campus menu. Requires meal_menu.read permission. Returns menu: null when the class is valid but no applicable menu exists.",
  })
  @ApiBadRequestResponse({
    description: "Invalid classId or weekStartDate query.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.read permission.",
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
    description: "Class UUID used to derive class, grade, and campus fallback.",
  })
  @ApiQuery({
    name: "weekStartDate",
    required: true,
    description:
      "Monday calendar anchor for the weekly menu. Date-only strings or ISO datetimes are accepted.",
  })
  async findEffectiveForClass(
    @CampusContext() campusId: string,
    @Query() query: EffectiveClassMealMenuQuery,
  ): Promise<EffectiveClassMealMenuResult> {
    return this.getEffectiveClassMealMenuUseCase.execute({
      campusId,
      classId: query.classId,
      weekStartDate: new Date(query.weekStartDate),
    });
  }

  @Get(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.read")
  @StandardResponse({
    message: "Meal menu retrieved successfully",
    type: MealMenuResponse,
  })
  @ApiOperation({
    summary: "Get meal menu by ID",
    description:
      "Retrieves one campus-scoped meal menu with entries and optional grade-level summary, including archived menus for authorized read callers. Requires meal_menu.read permission.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.read permission.",
  })
  @ApiNotFoundResponse({
    description: "Meal menu was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({
    name: "id",
    description: "Meal menu UUID",
  })
  async findById(
    @CampusContext() campusId: string,
    @Param("id") id: string,
  ): Promise<MealMenu> {
    return this.getMealMenuByIdUseCase.execute(campusId, id);
  }

  @Delete(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.delete")
  @StandardResponse({
    message: "Meal menu archived successfully",
    type: MealMenuResponse,
  })
  @ApiOperation({
    summary: "Archive meal menu",
    description:
      "Soft-archives a campus-scoped meal menu. Requires meal_menu.delete permission. Archived menus are hidden from default list results but remain readable/filterable for authorized callers.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.delete permission.",
  })
  @ApiNotFoundResponse({
    description: "Meal menu was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({
    name: "id",
    description: "Meal menu UUID",
  })
  async archive(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ): Promise<MealMenu> {
    return this.archiveMealMenuUseCase.execute(campusId, id, currentUser);
  }

  @Patch(":id/restore")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.update")
  @StandardResponse({
    message: "Meal menu restored successfully",
    type: MealMenuResponse,
  })
  @ApiOperation({
    summary: "Restore archived meal menu",
    description:
      "Restores an archived campus-scoped meal menu when no active menu already exists for the same campus, target, and week. Requires meal_menu.update permission.",
  })
  @ApiBadRequestResponse({
    description: "The meal menu is already active and cannot be restored.",
  })
  @ApiConflictResponse({
    description:
      "An active meal menu already exists for this campus, target, and week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.update permission.",
  })
  @ApiNotFoundResponse({
    description: "Meal menu was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({
    name: "id",
    description: "Meal menu UUID",
  })
  async restore(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ): Promise<MealMenu> {
    return this.restoreMealMenuUseCase.execute(campusId, id, currentUser);
  }

  @Post(":id/copy")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.create")
  @StandardResponse({
    message: "Meal menu copied successfully",
    type: MealMenuResponse,
  })
  @ApiOperation({
    summary: "Copy meal menu",
    description:
      "Copies an active source meal menu into a destination week and target. Requires meal_menu.create permission. The copied menu preserves the source days, meal slots, and entries while applying destination validation and uniqueness checks.",
  })
  @ApiBody({ type: CopyMealMenuRequest })
  @ApiBadRequestResponse({
    description:
      "Invalid destination target, invalid destination weekStartDate, or archived source menu.",
  })
  @ApiConflictResponse({
    description:
      "An active meal menu already exists for this campus, target, and week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.create permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Source menu, destination grade level, or destination class was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({
    name: "id",
    description: "Source meal menu UUID",
  })
  async copy(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: CopyMealMenuRequest,
    @CurrentUser() currentUser: User,
  ): Promise<MealMenu> {
    return this.copyMealMenuUseCase.execute(
      id,
      this.toCopyInput(campusId, dto),
      currentUser,
    );
  }

  @Post()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.create")
  @StandardResponse({
    message: "Meal menu created successfully",
    type: MealMenuResponse,
  })
  @ApiOperation({
    summary: "Create meal menu",
    description:
      "Creates a campus-scoped weekly meal menu for an explicit targetType. Requires meal_menu.create permission. When days or mealSlots are omitted, the backend snapshots saved config defaults or virtual defaults. campusId is resolved from campus context, never from the request body.",
  })
  @ApiBody({ type: CreateMealMenuRequest })
  @ApiBadRequestResponse({
    description:
      "Invalid target shape, invalid/non-Monday weekStartDate, invalid days/mealSlots, duplicate cells, or entries outside enabled days/slots.",
  })
  @ApiConflictResponse({
    description:
      "An active meal menu already exists for this campus, target, and week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.create permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Grade level or class target was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateMealMenuRequest,
    @CurrentUser() currentUser: User,
  ): Promise<MealMenu> {
    return this.createMealMenuUseCase.execute(
      this.toCreateInput(campusId, dto),
      currentUser,
    );
  }

  @Patch(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("meal_menu.update")
  @StandardResponse({
    message: "Meal menu updated successfully",
    type: MealMenuResponse,
  })
  @ApiOperation({
    summary: "Update meal menu",
    description:
      "Updates an active campus-scoped meal menu and replaces the stored grid entries in one save operation. Requires meal_menu.update permission. Archived menus must be restored before update.",
  })
  @ApiBody({ type: UpdateMealMenuRequest })
  @ApiBadRequestResponse({
    description:
      "Invalid target shape, archived menu mutation, invalid/non-Monday weekStartDate, invalid days/mealSlots, duplicate cells, or entries outside enabled days/slots.",
  })
  @ApiConflictResponse({
    description:
      "An active meal menu already exists for this campus, target, and week.",
  })
  @ApiForbiddenResponse({
    description: "Requires campus access and meal_menu.update permission.",
  })
  @ApiNotFoundResponse({
    description:
      "Meal menu, grade level target, or class target was not found in the active campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    required: true,
    description: "Campus UUID — system-enforced scope, NOT a user filter.",
  })
  @ApiParam({
    name: "id",
    description: "Meal menu UUID",
  })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateMealMenuRequest,
    @CurrentUser() currentUser: User,
  ): Promise<MealMenu> {
    return this.updateMealMenuUseCase.execute(
      id,
      this.toUpdateInput(campusId, dto),
      currentUser,
    );
  }

  private toListInput(
    campusId: string,
    query: ListMealMenusQuery,
  ): GetMealMenusInput {
    return {
      campusId,
      params: query,
      target: query.target,
      gradeLevelId: query.gradeLevelId,
      classId: query.classId,
    };
  }

  private toCreateInput(
    campusId: string,
    dto: CreateMealMenuRequest,
  ): CreateMealMenuInput {
    return {
      campusId,
      weekStartDate: new Date(dto.weekStartDate),
      targetType: dto.targetType,
      gradeLevelId: dto.gradeLevelId,
      classId: dto.classId,
      title: dto.title,
      days: dto.days,
      mealSlots: dto.mealSlots,
      entries: dto.entries,
    };
  }

  private toCopyInput(
    campusId: string,
    dto: CopyMealMenuRequest,
  ): CopyMealMenuInput {
    return {
      campusId,
      weekStartDate: new Date(dto.weekStartDate),
      targetType: dto.targetType,
      gradeLevelId: dto.gradeLevelId,
      classId: dto.classId,
      title: dto.title,
    };
  }

  private toUpdateInput(
    campusId: string,
    dto: UpdateMealMenuRequest,
  ): UpdateMealMenuInput {
    return {
      campusId,
      ...(dto.weekStartDate !== undefined
        ? { weekStartDate: new Date(dto.weekStartDate) }
        : {}),
      targetType: dto.targetType,
      ...(dto.gradeLevelId !== undefined
        ? { gradeLevelId: dto.gradeLevelId }
        : {}),
      ...(dto.classId !== undefined ? { classId: dto.classId } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.days !== undefined ? { days: dto.days } : {}),
      ...(dto.mealSlots !== undefined ? { mealSlots: dto.mealSlots } : {}),
      ...(dto.entries !== undefined ? { entries: dto.entries } : {}),
    };
  }
}
