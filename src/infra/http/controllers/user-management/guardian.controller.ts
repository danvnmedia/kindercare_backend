import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
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
  ApiParam,
} from "@nestjs/swagger";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import { HydrateCurrentUserGuard } from "../../guards/hydrate-current-user.guard";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { GetCurrentGuardianStudentsUseCase } from "@/application/absence-request";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { User } from "@/domain/user-management/user.entity";
import {
  CreateGuardianRequest,
  GuardianResponse,
  UpdateGuardianRequest,
  LinkGuardianStudentRequest,
  GuardianChildResponse,
} from "../../dtos/user-management/guardian";
import { LinkStudentGuardianResponse } from "../../dtos/user-management/student/student-guardian.response";
import { UpdateStudentGuardianRequest } from "../../dtos/user-management/student";

// Use Cases
import { CreateGuardianUseCase } from "@/application/user-management/use-cases/guardian/create-guardian.use-case";
import { ArchiveGuardianUseCase } from "@/application/user-management/use-cases/guardian/archive-guardian.use-case";
import { RestoreGuardianUseCase } from "@/application/user-management/use-cases/guardian/restore-guardian.use-case";
import { GetAllGuardiansUseCase } from "@/application/user-management/use-cases/guardian/get-all-guardians.use-case";
import { GetGuardianByIdUseCase } from "@/application/user-management/use-cases/guardian/get-guardian-by-id.use-case";
import { UpdateGuardianUseCase } from "@/application/user-management/use-cases/guardian/update-guardian.use-case";
import { LinkStudentToGuardianUseCase } from "@/application/user-management/use-cases/guardian/link-student-to-guardian.use-case";
import { UnlinkStudentFromGuardianUseCase } from "@/application/user-management/use-cases/guardian/unlink-student-from-guardian.use-case";
import { GetGuardianChildrenUseCase } from "@/application/user-management/use-cases/guardian/get-guardian-children.use-case";
import { UpdateStudentGuardianRelationshipUseCase } from "@/application/user-management/use-cases/student/update-student-guardian-relationship.use-case";

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
    private readonly linkStudentToGuardianUseCase: LinkStudentToGuardianUseCase,
    private readonly unlinkStudentFromGuardianUseCase: UnlinkStudentFromGuardianUseCase,
    private readonly getGuardianChildrenUseCase: GetGuardianChildrenUseCase,
    private readonly updateStudentGuardianRelationshipUseCase: UpdateStudentGuardianRelationshipUseCase,
    private readonly getCurrentGuardianStudentsUseCase: GetCurrentGuardianStudentsUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian created successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Create a new guardian",
    description:
      "Creates a new guardian with personal information and automatically creates a Clerk account with weak password (ChangeMe123!) that forces password reset on first login.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the guardian creation",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateGuardianRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.createGuardianUseCase.execute(
      {
        campusId,
        fullName: dto.fullName,
        dateOfBirth: dto.dateOfBirth,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        occupation: dto.occupation,
        workAddress: dto.workAddress,
        address: dto.address,
        gender: dto.gender as Gender,
      },
      currentUser,
    );
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

  @Get("me/students")
  @RequireCampusAccess({ checkUserAccess: false })
  @UseGuards(HydrateCurrentUserGuard)
  @StandardResponse({
    message: "Guardian students retrieved successfully",
    type: GuardianChildResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get students linked to the current guardian",
    description:
      "Retrieves active students linked to the authenticated guardian in the selected campus.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus ID to scope the request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getMyStudents(
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.getCurrentGuardianStudentsUseCase.execute(
      campusId,
      currentUser,
    );
  }

  @Get(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian retrieved successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Get a guardian by ID",
    description: "Retrieve a single guardian by their unique ID.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the guardian retrieval",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findOne(@CampusContext() campusId: string, @Param("id") id: string) {
    return await this.getGuardianByIdUseCase.execute(id, campusId);
  }

  @Patch(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian updated successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Update a guardian",
    description:
      "Update guardian information. Email and phone number uniqueness is enforced.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the guardian update",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @Body() dto: UpdateGuardianRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.updateGuardianUseCase.execute(
      id,
      {
        ...dto,
        gender: dto.gender as Gender,
      },
      currentUser,
    );
  }

  @Delete(":id")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian archived successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Archive a guardian (soft delete)",
    description:
      "Archives a guardian by locking their Clerk account and marking them as inactive. Use PATCH /guardians/:id/restore to restore. For permanent deletion, use DELETE /danger/guardians/:id.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the guardian archive",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async archive(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.archiveGuardianUseCase.execute(id, campusId, currentUser);
  }

  @Patch(":id/restore")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian restored successfully",
    type: GuardianResponse,
  })
  @ApiOperation({
    summary: "Restore an archived guardian",
    description:
      "Restores an archived guardian by unlocking their Clerk account and marking them as active.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID to scope the guardian restore",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async restore(
    @CampusContext() campusId: string,
    @Param("id") id: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.restoreGuardianUseCase.execute(id, campusId, currentUser);
  }

  // ========== Guardian-Student Relationship Endpoints ==========

  @Post(":id/students")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student linked to guardian successfully",
    type: LinkStudentGuardianResponse,
  })
  @ApiOperation({
    summary: "Link a student to a guardian",
    description:
      "Creates a relationship between a guardian and a student with a specified relationship type.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus ID to scope the request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Guardian ID",
    type: "string",
    format: "uuid",
  })
  async linkStudent(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) guardianId: string,
    @Body() dto: LinkGuardianStudentRequest,
    @CurrentUser() currentUser: User,
  ) {
    return await this.linkStudentToGuardianUseCase.execute(
      {
        guardianId,
        studentId: dto.studentId,
        relationshipId: dto.relationshipId,
      },
      currentUser,
    );
  }

  @Delete(":id/students/:studentId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student unlinked from guardian successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Unlink a student from a guardian",
    description: "Removes the relationship between a guardian and a student.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus ID to scope the request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Guardian ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "studentId",
    description: "Student ID to unlink",
    type: "string",
    format: "uuid",
  })
  async unlinkStudent(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) guardianId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @CurrentUser() currentUser: User,
  ) {
    await this.unlinkStudentFromGuardianUseCase.execute(
      {
        guardianId,
        studentId,
      },
      currentUser,
    );
    return null;
  }

  @Patch(":id/students/:studentId")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Student relationship updated successfully",
    type: LinkStudentGuardianResponse,
  })
  @ApiOperation({
    summary: "Update guardian relationship type on an existing link",
    description:
      "Atomically updates the relationship type (e.g., Mother → Stepmother) on the existing guardian-student link without dropping and recreating the row. Alias of PATCH /students/:studentId/guardians/:guardianId.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus ID to scope the request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Guardian ID",
    type: "string",
    format: "uuid",
  })
  @ApiParam({
    name: "studentId",
    description: "Student ID",
    type: "string",
    format: "uuid",
  })
  async updateStudentRelationship(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) guardianId: string,
    @Param("studentId", ParseUUIDPipe) studentId: string,
    @Body() dto: UpdateStudentGuardianRequest,
  ) {
    return await this.updateStudentGuardianRelationshipUseCase.execute({
      studentId,
      guardianId,
      campusId,
      relationshipId: dto.relationshipId,
    });
  }

  @Get(":id/students")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Guardian children retrieved successfully",
    type: GuardianChildResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all students of a guardian",
    description:
      "Retrieves all students linked to a guardian with their relationship types.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus ID to scope the request",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Guardian ID",
    type: "string",
    format: "uuid",
  })
  async getChildren(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) guardianId: string,
  ) {
    return await this.getGuardianChildrenUseCase.execute(guardianId, campusId);
  }
}
