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
  ApiBearerAuth,
  ApiHeader,
} from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { User } from "@/domain/user-management/user.entity";

// DTOs
import {
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignUsersRequest,
  RoleResponse,
} from "../../dtos/user-management/role";
import { AssignPermissionsRequest, PermissionResponse } from "../../dtos/rbac";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases - Role
import { CreateRoleUseCase } from "@/application/user-management/use-cases/role/create-role.use-case";
import { GetRoleByIdUseCase } from "@/application/user-management/use-cases/role/get-role-by-id.use-case";
import { GetAllRolesUseCase } from "@/application/user-management/use-cases/role/get-all-roles.use-case";
import { UpdateRoleUseCase } from "@/application/user-management/use-cases/role/update-role.use-case";
import { DeleteRoleUseCase } from "@/application/user-management/use-cases/role/delete-role.use-case";
import { AssignUsersToRoleUseCase } from "@/application/user-management/use-cases/role/assign-users-to-role.use-case";
import { RemoveUsersFromRoleUseCase } from "@/application/user-management/use-cases/role/remove-users-from-role.use-case";

// Use Cases - RBAC
import {
  GetAllPermissionsUseCase,
  AssignPermissionsToRoleUseCase,
  RemovePermissionsFromRoleUseCase,
} from "@/application/rbac";

@Controller("roles")
@ApiTags("Roles")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class RoleController {
  constructor(
    private readonly createRoleUseCase: CreateRoleUseCase,
    private readonly getRoleByIdUseCase: GetRoleByIdUseCase,
    private readonly getAllRolesUseCase: GetAllRolesUseCase,
    private readonly updateRoleUseCase: UpdateRoleUseCase,
    private readonly deleteRoleUseCase: DeleteRoleUseCase,
    private readonly assignUsersToRoleUseCase: AssignUsersToRoleUseCase,
    private readonly removeUsersFromRoleUseCase: RemoveUsersFromRoleUseCase,
    private readonly getAllPermissionsUseCase: GetAllPermissionsUseCase,
    private readonly assignPermissionsToRoleUseCase: AssignPermissionsToRoleUseCase,
    private readonly removePermissionsFromRoleUseCase: RemovePermissionsFromRoleUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Role created successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Create a new role",
    description: "Create a new role with permissions",
  })
  async create(@Body() dto: CreateRoleRequest) {
    return await this.createRoleUseCase.execute(dto);
  }

  @Get()
  @StandardResponse({
    message: "Roles retrieved successfully",
    type: RoleResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all roles",
    description: "Retrieve all roles with filtering, sorting, and pagination",
  })
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllRolesUseCase.execute(query);
  }

  @Get(":id")
  @StandardResponse({
    message: "Role retrieved successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Get role by ID",
    description: "Retrieve a single role by its ID",
  })
  async findOne(@Param("id") id: string) {
    const normalizedId = id.toLowerCase();
    return await this.getRoleByIdUseCase.execute(normalizedId);
  }

  @Patch(":id")
  @StandardResponse({
    message: "Role updated successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Update role",
    description: "Update role information and permissions",
  })
  async update(@Param("id") id: string, @Body() dto: UpdateRoleRequest) {
    const normalizedId = id.toLowerCase();
    return await this.updateRoleUseCase.execute(normalizedId, dto);
  }

  @Delete(":id")
  @StandardResponse({
    message: "Role deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete role",
    description: "Delete a role from the system",
  })
  async remove(@Param("id") id: string) {
    const normalizedId = id.toLowerCase();
    await this.deleteRoleUseCase.execute(normalizedId);
  }

  @Post(":id/users")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Users assigned successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Assign users to role",
    description:
      "Grant a campus-scoped role to one or more users. Emits a GRANT_ROLE audit event per (userId, roleId, campusId) pair that actually changes state. System roles cannot be granted via this endpoint.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async assignUsers(
    @Param("id") id: string,
    @CampusContext() campusId: string,
    @Body() dto: AssignUsersRequest,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    await this.assignUsersToRoleUseCase.execute(
      { roleId: normalizedId, userIds: dto.userIds, campusId },
      currentUser,
    );
  }

  @Delete(":id/users")
  @RequireCampusAccess()
  @StandardResponse({
    message: "Users removed successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Remove users from role",
    description:
      "Revoke a campus-scoped role from one or more users. Emits a REVOKE_ROLE audit event per (userId, roleId, campusId) pair that actually changes state (D4 no-op suppression: a user who never held the role produces no audit row). System roles cannot be revoked via this endpoint. Admin revoke deletes both manual and staff-type-tracked rows by natural key (Scenario 9 — admin override).",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async removeUsers(
    @Param("id") id: string,
    @CampusContext() campusId: string,
    @Body() dto: AssignUsersRequest,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    await this.removeUsersFromRoleUseCase.execute(
      { roleId: normalizedId, userIds: dto.userIds, campusId },
      currentUser,
    );
  }

  // =====================
  // Permission Endpoints
  // =====================

  @Get("permissions/all")
  @StandardResponse({
    message: "Permissions retrieved successfully",
    type: PermissionResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all available permissions",
    description:
      "Retrieve all system permissions that can be assigned to roles",
  })
  async getAllPermissions() {
    return await this.getAllPermissionsUseCase.execute();
  }

  @Post(":id/permissions")
  @StandardResponse({
    message: "Permissions assigned successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Assign permissions to role",
    description: "Assign multiple permissions to a role",
  })
  async assignPermissions(
    @Param("id") id: string,
    @Body() dto: AssignPermissionsRequest,
  ) {
    const normalizedId = id.toLowerCase();
    await this.assignPermissionsToRoleUseCase.execute({
      roleId: normalizedId,
      permissionIds: dto.permissionIds,
    });
  }

  @Delete(":id/permissions")
  @StandardResponse({
    message: "Permissions removed successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Remove permissions from role",
    description: "Remove multiple permissions from a role",
  })
  async removePermissions(
    @Param("id") id: string,
    @Body() dto: AssignPermissionsRequest,
  ) {
    const normalizedId = id.toLowerCase();
    await this.removePermissionsFromRoleUseCase.execute({
      roleId: normalizedId,
      permissionIds: dto.permissionIds,
    });
  }
}
