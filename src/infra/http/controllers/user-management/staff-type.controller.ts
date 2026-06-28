import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiHeader,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { Permissions } from "../../decorators/permissions.decorator";
import { StandardRequestParam } from "@/core/modules/standard-response";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { User } from "@/domain/user-management/user.entity";

import {
  CreateStaffTypeRequest,
  UpdateStaffTypeRequest,
  ReorderStaffTypesRequest,
  StaffTypeResponse,
} from "../../dtos/user-management/staff-type";

import { CreateStaffTypeUseCase } from "@/application/user-management/use-cases/staff-type/create-staff-type.use-case";
import { GetStaffTypeByIdUseCase } from "@/application/user-management/use-cases/staff-type/get-staff-type-by-id.use-case";
import { GetAllStaffTypesUseCase } from "@/application/user-management/use-cases/staff-type/get-all-staff-types.use-case";
import { UpdateStaffTypeUseCase } from "@/application/user-management/use-cases/staff-type/update-staff-type.use-case";
import { DeleteStaffTypeUseCase } from "@/application/user-management/use-cases/staff-type/delete-staff-type.use-case";
import { ReorderStaffTypesUseCase } from "@/application/user-management/use-cases/staff-type/reorder-staff-types.use-case";

@Controller("staff-types")
@ApiTags("Staff Types")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StaffTypeController {
  constructor(
    private readonly createStaffTypeUseCase: CreateStaffTypeUseCase,
    private readonly getStaffTypeByIdUseCase: GetStaffTypeByIdUseCase,
    private readonly getAllStaffTypesUseCase: GetAllStaffTypesUseCase,
    private readonly updateStaffTypeUseCase: UpdateStaffTypeUseCase,
    private readonly deleteStaffTypeUseCase: DeleteStaffTypeUseCase,
    private readonly reorderStaffTypesUseCase: ReorderStaffTypesUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("staff_type.create")
  @StandardResponse({
    message: "Staff type created successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Create a new staff type",
    description:
      "Create a new staff type for a campus. Staff type name must be unique within the campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff type creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateStaffTypeRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.createStaffTypeUseCase.execute(
      {
        ...dto,
        campusId,
      },
      currentUser,
    );
  }

  @Post("reorder")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("staff_type.update")
  @StandardResponse({
    message: "Staff types reordered successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Reorder staff types",
    description:
      "Reorder staff types within a campus. Provide an array of staff type IDs in the desired order.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the reorder operation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async reorder(
    @CampusContext() campusId: string,
    @Body() dto: ReorderStaffTypesRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.reorderStaffTypesUseCase.execute(
      {
        campusId,
        ids: dto.ids,
      },
      currentUser,
    );
  }

  @Get()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("staff_type.list")
  @StandardResponse({
    message: "Staff types retrieved successfully",
    type: StaffTypeResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all staff types",
    description:
      "Retrieve all staff types for the active campus with pagination, filtering, and sorting. Supports filtering by name, description, isArchived, defaultRoleId, order.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the list",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CampusContext() campusId: string,
    @StandardRequestParam() query: StandardRequestDto,
  ) {
    return await this.getAllStaffTypesUseCase.execute({
      campusId,
      params: query,
    });
  }

  @Get(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("staff_type.read")
  @StandardResponse({
    message: "Staff type retrieved successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Get a staff type by ID",
    description: "Retrieve a single staff type by its ID.",
  })
  @ApiParam({
    name: "id",
    description: "Staff Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff type lookup",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@Param("id") id: string, @CampusContext() campusId: string) {
    return await this.getStaffTypeByIdUseCase.execute(id, campusId);
  }

  @Patch(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("staff_type.update")
  @StandardResponse({
    message: "Staff type updated successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Update a staff type",
    description:
      "Update staff type name, description, default role, or archived status.",
  })
  @ApiParam({
    name: "id",
    description: "Staff Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff type update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateStaffTypeRequest,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.updateStaffTypeUseCase.execute(
      id,
      { ...dto, campusId },
      currentUser,
    );
  }

  @Delete(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("staff_type.delete")
  @StandardResponse({
    message: "Staff type archived successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Archive a staff type",
    description:
      "Soft delete a staff type by setting isArchived to true. The staff type data is retained.",
  })
  @ApiParam({
    name: "id",
    description: "Staff Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff type archive",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(
    @Param("id") id: string,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.deleteStaffTypeUseCase.execute(
      id,
      { campusId },
      currentUser,
    );
  }
}
