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
  ApiOperation,
  ApiTags,
  ApiParam,
  ApiHeader,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";

import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import {
  CreateStaffRequest,
  CreateOrAttachStaffResponse,
  UpdateStaffRequest,
  StaffResponse,
} from "../../dtos/user-management/staff";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";

// Use Cases
import { CreateStaffUseCase } from "@/application/user-management/use-cases/staff/create-staff.use-case";
import { CreateOrAttachStaffUseCase } from "@/application/user-management/use-cases/staff/create-or-attach-staff.use-case";
import { GetStaffByIdUseCase } from "@/application/user-management/use-cases/staff/get-staff-by-id.use-case";
import { GetAllStaffUseCase } from "@/application/user-management/use-cases/staff/get-all-staff.use-case";
import { UpdateStaffUseCase } from "@/application/user-management/use-cases/staff/update-staff.use-case";
import { ArchiveStaffUseCase } from "@/application/user-management/use-cases/staff/archive-staff.use-case";
import { RestoreStaffUseCase } from "@/application/user-management/use-cases/staff/restore-staff.use-case";

@Controller("staff")
@ApiTags("Staff")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StaffController {
  constructor(
    private readonly createStaffUseCase: CreateStaffUseCase,
    private readonly createOrAttachStaffUseCase: CreateOrAttachStaffUseCase,
    private readonly getStaffByIdUseCase: GetStaffByIdUseCase,
    private readonly getAllStaffUseCase: GetAllStaffUseCase,
    private readonly updateStaffUseCase: UpdateStaffUseCase,
    private readonly archiveStaffUseCase: ArchiveStaffUseCase,
    private readonly restoreStaffUseCase: RestoreStaffUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff created successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Create a new staff member",
    description:
      "Creates a new staff member with personal information and automatically creates a Clerk account with weak password (ChangeMe123!) that forces password reset on first login. The staff member is automatically assigned a role based on their staffType (teacher, nurse, principal, or staff).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateStaffRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.createStaffUseCase.execute(
      {
        campusId,
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        staffTypeIds: dto.staffTypeIds,
        address: dto.address,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender as Gender | undefined,
      },
      currentUser,
    );
  }

  @Post("create-or-attach")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff create-or-attach completed successfully",
    type: CreateOrAttachStaffResponse,
  })
  @ApiOperation({
    summary: "Create or attach a staff account",
    description:
      "Creates a target-campus staff profile by either provisioning a new staff identity or attaching to an eligible existing identity.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff create-or-attach operation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async createOrAttach(
    @CampusContext() campusId: string,
    @Body() dto: CreateStaffRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.createOrAttachStaffUseCase.execute(
      {
        campusId,
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        staffTypeIds: dto.staffTypeIds,
        address: dto.address,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender as Gender | undefined,
      },
      currentUser,
    );
  }

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff retrieved successfully",
    type: StaffResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all staff members",
    description:
      "Retrieve all staff members within a campus with advanced filtering, sorting, and pagination. Requires X-Campus-Id header. Supports filtering by staffCode, fullName, email, phoneNumber, staffType, gender, isArchived. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the staff list",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: StandardRequestDto,
  ) {
    return await this.getAllStaffUseCase.execute({ campusId, params: query });
  }

  @Get(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff retrieved successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Get staff by ID",
    description:
      "Retrieve a single staff member by their unique identifier within the specified campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify staff access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@CampusContext() campusId: string, @Param("id") id: string) {
    return await this.getStaffByIdUseCase.execute({ id, campusId });
  }

  @Patch(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff updated successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Update staff",
    description:
      "Update staff profile information within the specified campus. For linked staff identities, fullName, email, and phoneNumber changes are rejected and must use a dedicated identity-change flow. Staff type changes update StaffType-derived role grants while preserving manual grants.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify staff access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateStaffRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.updateStaffUseCase.execute(
      id,
      {
        campusId,
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        staffTypeIds: dto.staffTypeIds,
        address: dto.address,
        dateOfBirth: dto.dateOfBirth,
        gender: dto.gender as Gender | undefined,
      },
      currentUser,
    );
  }

  @Delete(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff archived successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Archive staff (soft delete)",
    description:
      "Archives only the campus staff profile. Linked User and Clerk identities remain active unless changed through global identity administration; StaffType-derived grants for this profile are removed.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify staff access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async archive(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.archiveStaffUseCase.execute(id, campusId, currentUser);
  }

  @Patch(":id/restore")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Staff restored successfully",
    type: StaffResponse,
  })
  @ApiOperation({
    summary: "Restore archived staff",
    description:
      "Restores only the campus staff profile and recreates StaffType-derived grants. This does not unlock or reactivate the linked global identity.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to verify staff access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Staff UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async restore(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.restoreStaffUseCase.execute(id, campusId, currentUser);
  }
}
