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
  CreateGuardianRelationshipTypeRequest,
  UpdateGuardianRelationshipTypeRequest,
  ReorderGuardianRelationshipTypesRequest,
  GuardianRelationshipTypeResponse,
} from "../../dtos/user-management/guardian-relationship-type";

import { CreateGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/create-guardian-relationship-type.use-case";
import { GetGuardianRelationshipTypeByIdUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/get-guardian-relationship-type-by-id.use-case";
import { GetAllGuardianRelationshipTypesUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/get-all-guardian-relationship-types.use-case";
import { UpdateGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/update-guardian-relationship-type.use-case";
import { DeleteGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/delete-guardian-relationship-type.use-case";
import { RestoreGuardianRelationshipTypeUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/restore-guardian-relationship-type.use-case";
import { ReorderGuardianRelationshipTypesUseCase } from "@/application/user-management/use-cases/guardian-relationship-type/reorder-guardian-relationship-types.use-case";

@Controller("guardian-relationship-types")
@ApiTags("Guardian Relationship Types")
@UseGuards(ClerkAuthGuard)
export class GuardianRelationshipTypeController {
  constructor(
    private readonly createUseCase: CreateGuardianRelationshipTypeUseCase,
    private readonly getByIdUseCase: GetGuardianRelationshipTypeByIdUseCase,
    private readonly getAllUseCase: GetAllGuardianRelationshipTypesUseCase,
    private readonly updateUseCase: UpdateGuardianRelationshipTypeUseCase,
    private readonly deleteUseCase: DeleteGuardianRelationshipTypeUseCase,
    private readonly restoreUseCase: RestoreGuardianRelationshipTypeUseCase,
    private readonly reorderUseCase: ReorderGuardianRelationshipTypesUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian relationship type created successfully",
    type: GuardianRelationshipTypeResponse,
  })
  @ApiOperation({
    summary: "Create a new guardian relationship type",
    description:
      "Create a new guardian relationship type for a campus. Name must be unique within the campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateGuardianRelationshipTypeRequest,
  ) {
    return await this.createUseCase.execute({
      ...dto,
      campusId,
    });
  }

  @Post("reorder")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian relationship types reordered successfully",
    type: GuardianRelationshipTypeResponse,
  })
  @ApiOperation({
    summary: "Reorder guardian relationship types",
    description:
      "Reorder guardian relationship types within a campus. Provide an array of IDs in the desired order.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the reorder operation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async reorder(
    @CampusContext() campusId: string,
    @Body() dto: ReorderGuardianRelationshipTypesRequest,
  ) {
    return await this.reorderUseCase.execute({
      campusId,
      ids: dto.ids,
    });
  }

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian relationship types retrieved successfully",
    type: GuardianRelationshipTypeResponse,
    isPaginated: true,
  })
  @ApiOperation({
    summary: "Get all guardian relationship types",
    description:
      "Retrieve all guardian relationship types for the active campus with pagination, filtering, and sorting.",
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
    return await this.getAllUseCase.execute({ campusId, params: query });
  }

  @Get(":id")
  @StandardResponse({
    message: "Guardian relationship type retrieved successfully",
    type: GuardianRelationshipTypeResponse,
  })
  @ApiOperation({
    summary: "Get a guardian relationship type by ID",
    description: "Retrieve a single guardian relationship type by its ID.",
  })
  @ApiParam({
    name: "id",
    description: "Guardian Relationship Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findById(@Param("id") id: string) {
    return await this.getByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Guardian relationship type updated successfully",
    type: GuardianRelationshipTypeResponse,
  })
  @ApiOperation({
    summary: "Update a guardian relationship type",
    description: "Update name, description, or archived status.",
  })
  @ApiParam({
    name: "id",
    description: "Guardian Relationship Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateGuardianRelationshipTypeRequest,
  ) {
    return await this.updateUseCase.execute(id, dto);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Guardian relationship type archived successfully",
    type: GuardianRelationshipTypeResponse,
  })
  @ApiOperation({
    summary: "Archive a guardian relationship type",
    description:
      "Soft delete a guardian relationship type by setting isArchived to true.",
  })
  @ApiParam({
    name: "id",
    description: "Guardian Relationship Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async delete(@Param("id") id: string) {
    return await this.deleteUseCase.execute(id);
  }

  @Patch(":id/restore")
  @StandardResponse({
    message: "Guardian relationship type restored successfully",
    type: GuardianRelationshipTypeResponse,
  })
  @ApiOperation({
    summary: "Restore an archived guardian relationship type",
    description: "Restore a previously archived guardian relationship type.",
  })
  @ApiParam({
    name: "id",
    description: "Guardian Relationship Type UUID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async restore(@Param("id") id: string) {
    return await this.restoreUseCase.execute(id);
  }
}
