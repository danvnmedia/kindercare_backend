import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiParam } from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";

import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import {
  CreateStaffRequest,
  UpdateStaffRequest,
  StaffResponse,
} from "../../dtos/user-management/staff";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases
import { CreateStaffUseCase } from "@/application/user-management/use-cases/staff/create-staff.use-case";
import { GetStaffByIdUseCase } from "@/application/user-management/use-cases/staff/get-staff-by-id.use-case";
import { GetAllStaffUseCase } from "@/application/user-management/use-cases/staff/get-all-staff.use-case";
import { UpdateStaffUseCase } from "@/application/user-management/use-cases/staff/update-staff.use-case";
import { ArchiveStaffUseCase } from "@/application/user-management/use-cases/staff/archive-staff.use-case";
import { RestoreStaffUseCase } from "@/application/user-management/use-cases/staff/restore-staff.use-case";

@Controller("staff")
@ApiTags("Staff")
export class StaffController {
  constructor(
    private readonly createStaffUseCase: CreateStaffUseCase,
    private readonly getStaffByIdUseCase: GetStaffByIdUseCase,
    private readonly getAllStaffUseCase: GetAllStaffUseCase,
    private readonly updateStaffUseCase: UpdateStaffUseCase,
    private readonly archiveStaffUseCase: ArchiveStaffUseCase,
    private readonly restoreStaffUseCase: RestoreStaffUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Staff created successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Create a new staff member",
    description:
      "Creates a new staff member with personal information and automatically creates a Clerk account with weak password (ChangeMe123!) that forces password reset on first login. The staff member is automatically assigned a role based on their staffType (teacher, nurse, principal, or staff).",
  })
  async create(@Body() dto: CreateStaffRequest) {
    return await this.createStaffUseCase.execute({
      ...dto,
      staffType: dto.staffType as StaffType,
      gender: dto.gender as Gender | undefined,
    });
  }

  @Get()
  @StandardResponse({
    message: "Staff retrieved successfully",
    type: StaffResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all staff members",
    description:
      "Retrieve all staff members with advanced filtering, sorting, and pagination. Supports filtering by fullName, email, phoneNumber, staffType, gender, isArchived. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllStaffUseCase.execute(query);
  }

  @Get(":id")
  @StandardResponse({
    message: "Staff retrieved successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Get staff by ID",
    description: "Retrieve a single staff member by their unique identifier.",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@Param("id") id: string) {
    return await this.getStaffByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Staff updated successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Update staff",
    description:
      "Update staff information. If staffType is changed, the associated user role will also be updated accordingly.",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateStaffRequest) {
    return await this.updateStaffUseCase.execute(id, {
      ...dto,
      staffType: dto.staffType as StaffType | undefined,
      gender: dto.gender as Gender | undefined,
    });
  }

  @Delete(":id")
  @StandardResponse({
    message: "Staff archived successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Archive staff (soft delete)",
    description:
      "Archives a staff member (soft delete). The staff member's linked user account will also be deactivated.",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async archive(@Param("id") id: string) {
    return await this.archiveStaffUseCase.execute(id);
  }

  @Post(":id/restore")
  @StandardResponse({
    message: "Staff restored successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Restore archived staff",
    description:
      "Restores a previously archived staff member. The staff member's linked user account will also be reactivated.",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async restore(@Param("id") id: string) {
    return await this.restoreStaffUseCase.execute(id);
  }
}
