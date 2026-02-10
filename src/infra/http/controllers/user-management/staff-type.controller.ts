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
import { ApiOperation, ApiTags, ApiParam, ApiHeader } from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { StandardRequestParam } from "@/core/modules/standard-response";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

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
  ) {
    return await this.createStaffTypeUseCase.execute({
      ...dto,
      campusId,
    });
  }

  @Post("reorder")
  @RequireCampusAccess()
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
  ) {
    return await this.reorderStaffTypesUseCase.execute({
      campusId,
      ids: dto.ids,
    });
  }

  @Get()
  @StandardResponse({
    message: "Staff types retrieved successfully",
    type: StaffTypeResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all staff types",
    description:
      "Retrieve all staff types with pagination, filtering, and sorting. Supports filtering by campusId, name, description, isActive, defaultRoleId, order.",
  })
  async findAll(@StandardRequestParam() query: StandardRequestDto) {
    return await this.getAllStaffTypesUseCase.execute(query);
  }

  @Get(":id")
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
  async findById(@Param("id") id: string) {
    return await this.getStaffTypeByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Staff type updated successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Update a staff type",
    description:
      "Update staff type name, description, default role, or active status.",
  })
  @ApiParam({
    name: "id",
    description: "Staff Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateStaffTypeRequest) {
    return await this.updateStaffTypeUseCase.execute(id, dto);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Staff type deactivated successfully",
    type: StaffTypeResponse,
  })
  @ApiOperation({
    summary: "Deactivate a staff type",
    description:
      "Soft delete a staff type by setting isActive to false. The staff type data is retained.",
  })
  @ApiParam({
    name: "id",
    description: "Staff Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(@Param("id") id: string) {
    return await this.deleteStaffTypeUseCase.execute(id);
  }
}
