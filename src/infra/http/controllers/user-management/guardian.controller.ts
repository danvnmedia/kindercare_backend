import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
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
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiHeader,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  CreateGuardianRequest,
  GuardianResponse,
  UpdateGuardianRequest,
} from "../../dtos/user-management/guardian";

// Use Cases
import { CreateGuardianUseCase } from "@/application/user-management/use-cases/guardian/create-guardian.use-case";
import { ArchiveGuardianUseCase } from "@/application/user-management/use-cases/guardian/archive-guardian.use-case";
import { RestoreGuardianUseCase } from "@/application/user-management/use-cases/guardian/restore-guardian.use-case";
import { GetAllGuardiansUseCase } from "@/application/user-management/use-cases/guardian/get-all-guardians.use-case";
import { GetGuardianByIdUseCase } from "@/application/user-management/use-cases/guardian/get-guardian-by-id.use-case";
import { UpdateGuardianUseCase } from "@/application/user-management/use-cases/guardian/update-guardian.use-case";

@Controller("guardians")
@ApiTags("Guardians")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class GuardianController {
  constructor(
    private readonly createGuardianUseCase: CreateGuardianUseCase,
    private readonly getAllGuardiansUseCase: GetAllGuardiansUseCase,
    private readonly getGuardianByIdUseCase: GetGuardianByIdUseCase,
    private readonly updateGuardianUseCase: UpdateGuardianUseCase,
    private readonly archiveGuardianUseCase: ArchiveGuardianUseCase,
    private readonly restoreGuardianUseCase: RestoreGuardianUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Guardian created successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Create a new guardian",
    description:
      "Creates a new guardian with personal information and automatically creates a Clerk account with weak password (ChangeMe12-3!) that forces password reset on first login.",
  })
  async create(@Body() dto: CreateGuardianRequest) {
    return await this.createGuardianUseCase.execute({
      campusId: dto.campusId,
      fullName: dto.fullName,
      dateOfBirth: dto.dateOfBirth,
      email: dto.email,
      phoneNumber: dto.phoneNumber,
      occupation: dto.occupation,
      workAddress: dto.workAddress,
      address: dto.address,
      gender: dto.gender as Gender,
    });
  }

  @Get()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardians retrieved successfully",
    type: GuardianResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all guardians",
    description:
      "Retrieve all guardians within a campus with advanced filtering, sorting, and pagination. Requires X-Campus-Id header. Supports filtering by fullName, occupation, workAddress. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the guardian list",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CampusContext() campusId: string,
    @Query() query: StandardRequestDto,
  ) {
    return await this.getAllGuardiansUseCase.execute({
      campusId,
      params: query,
    });
  }

  @Get(":id")
  @StandardResponse({
    message: "Guardian retrieved successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Get a guardian by ID",
    description: "Retrieve a single guardian by their unique ID.",
  })
  async findOne(@Param("id") id: string) {
    return await this.getGuardianByIdUseCase.execute(id);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Guardian updated successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Update a guardian",
    description:
      "Update guardian information. Email and phone number uniqueness is enforced.",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateGuardianRequest) {
    return await this.updateGuardianUseCase.execute(id, {
      ...dto,
      gender: dto.gender as Gender,
    });
  }

  @Delete(":id")
  @StandardResponse({
    message: "Guardian archived successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Archive a guardian (soft delete)",
    description:
      "Archives a guardian by locking their Clerk account and marking them as inactive. Use PATCH /guardians/:id/restore to restore. For permanent deletion, use DELETE /danger/guardians/:id.",
  })
  async archive(@Param("id") id: string) {
    return await this.archiveGuardianUseCase.execute(id);
  }

  @Patch(":id/restore")
  @StandardResponse({
    message: "Guardian restored successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Restore an archived guardian",
    description:
      "Restores an archived guardian by unlocking their Clerk account and marking them as active.",
  })
  async restore(@Param("id") id: string) {
    return await this.restoreGuardianUseCase.execute(id);
  }
}
