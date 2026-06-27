import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiResponse,
} from "@nestjs/swagger";
import { StandardResponse } from "@/core/modules/standard-response/decorators/standard-response.decorator";
import { ClerkAuthGuard } from "../../guards/clerk-auth.guard";
import {
  CampusContext,
  CurrentUser,
  RequireCampusAccess,
  CAMPUS_ID_HEADER,
} from "../../decorators";
import { Permissions } from "../../decorators/permissions.decorator";
import { PermissionsGuard } from "../../guards/permissions.guard";
import { User } from "@/domain/user-management/user.entity";

// DTOs
import {
  CreateRoleRequest,
  UpdateRoleRequest,
  AssignUsersRequest,
  RoleResponse,
  RoleMemberResponse,
} from "../../dtos/user-management/role";
import {
  AssignPermissionsRequest,
  PermissionResponse,
  ReplaceRolePermissionsRequest,
} from "../../dtos/rbac";
import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";

// Use Cases - Role
import { CreateRoleUseCase } from "@/application/user-management/use-cases/role/create-role.use-case";
import { GetRoleByIdUseCase } from "@/application/user-management/use-cases/role/get-role-by-id.use-case";
import { GetAllRolesUseCase } from "@/application/user-management/use-cases/role/get-all-roles.use-case";
import { UpdateRoleUseCase } from "@/application/user-management/use-cases/role/update-role.use-case";
import { DeleteRoleUseCase } from "@/application/user-management/use-cases/role/delete-role.use-case";
import { AssignUsersToRoleUseCase } from "@/application/user-management/use-cases/role/assign-users-to-role.use-case";
import { RemoveUsersFromRoleUseCase } from "@/application/user-management/use-cases/role/remove-users-from-role.use-case";
import { GetRoleMembersUseCase } from "@/application/user-management/use-cases/role/get-role-members.use-case";

// Use Cases - RBAC
import {
  GetAllPermissionsUseCase,
  AssignPermissionsToRoleUseCase,
  RemovePermissionsFromRoleUseCase,
  ReplaceRolePermissionsUseCase,
} from "@/application/rbac";

@Controller("roles")
@ApiTags("Roles")
@ApiBearerAuth("JWT")
@ApiResponse({
  status: 400,
  description:
    "Invalid campus, cross-campus role, read-only/system role, or invalid permission request.",
})
@ApiResponse({
  status: 401,
  description: "Missing or invalid Clerk JWT.",
})
@ApiResponse({
  status: 403,
  description:
    "Authenticated user lacks the required role permission or campus access.",
})
@ApiResponse({
  status: 404,
  description: "Role or target user was not found.",
})
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
    private readonly getRoleMembersUseCase: GetRoleMembersUseCase,
    private readonly getAllPermissionsUseCase: GetAllPermissionsUseCase,
    private readonly assignPermissionsToRoleUseCase: AssignPermissionsToRoleUseCase,
    private readonly removePermissionsFromRoleUseCase: RemovePermissionsFromRoleUseCase,
    private readonly replaceRolePermissionsUseCase: ReplaceRolePermissionsUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.create")
  @StandardResponse({
    message: "Role created successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Create a new role",
    description:
      "Create a campus-scoped role with optional permissions. Requires role.create in the campus context. System/global roles cannot be created via API.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID used to scope the new role",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async create(
    @Body() dto: CreateRoleRequest,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    return await this.createRoleUseCase.execute(
      { ...dto, campusId },
      currentUser,
    );
  }

  @Get()
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.list")
  @StandardResponse({
    message: "Roles retrieved successfully",
    type: RoleResponse,
    isPaginated: true,
    allowedSortFields: ["createdAt", "name"],
    allowedFilterFields: [
      "name",
      "description",
      "isSystemDefault",
      "isSystemRole",
    ],
  })
  @ApiOperation({
    summary: "Get campus roles",
    description:
      "Retrieve roles visible in the current campus, including read-only system roles. Requires role.list in the campus context.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID used to scope role management",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @Query() query: StandardRequestDto,
    @CampusContext() campusId: string,
  ) {
    return await this.getAllRolesUseCase.execute(query, {
      campusId,
      includeSystemRoles: true,
    });
  }

  @Get("permissions/all")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.read")
  @StandardResponse({
    message: "Permissions retrieved successfully",
    type: PermissionResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: "Get all available permissions",
    description:
      "Retrieve system permissions that can be assigned to campus roles. Requires role.read in the campus context.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID used to authorize permission catalog access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getAllPermissions() {
    return await this.getAllPermissionsUseCase.execute();
  }

  @Get("audit/global")
  @UseGuards(PermissionsGuard)
  @Permissions("role.list")
  @StandardResponse({
    message: "Global roles retrieved successfully",
    type: RoleResponse,
    isPaginated: true,
    allowedSortFields: ["createdAt", "name"],
    allowedFilterFields: [
      "name",
      "description",
      "campusId",
      "isSystemDefault",
      "isSystemRole",
    ],
  })
  @ApiOperation({
    summary: "Get global RBAC audit role view",
    description:
      "Retrieve a read-only global role audit view. Requires role.list from a global role assignment.",
  })
  async findGlobalAudit(@Query() query: StandardRequestDto) {
    return await this.getAllRolesUseCase.execute(query);
  }

  @Get(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.read")
  @StandardResponse({
    message: "Role retrieved successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Get role by ID",
    description:
      "Retrieve a single campus-visible role by ID. Campus roles must belong to the current campus; system roles are visible as read-only.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID used to scope role detail access",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findOne(@Param("id") id: string, @CampusContext() campusId: string) {
    const normalizedId = id.toLowerCase();
    return await this.getRoleByIdUseCase.execute(normalizedId, {
      campusId,
      includeSystemRoles: true,
    });
  }

  @Patch(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.update")
  @StandardResponse({
    message: "Role updated successfully",
    type: RoleResponse,
  })
  @ApiOperation({
    summary: "Update role",
    description:
      "Update a campus-scoped role. Requires role.update in the campus context. System/default/global roles are read-only.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateRoleRequest,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    return await this.updateRoleUseCase.execute(
      normalizedId,
      { ...dto, campusId },
      currentUser,
    );
  }

  @Delete(":id")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.delete")
  @StandardResponse({
    message: "Role deleted successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Delete role",
    description:
      "Delete a campus-scoped role. Requires role.delete in the campus context. System/default/global roles are read-only.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async remove(
    @Param("id") id: string,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    await this.deleteRoleUseCase.execute(
      normalizedId,
      { campusId },
      currentUser,
    );
  }

  @Get(":id/users")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.read", "role.assign")
  @StandardResponse({
    message: "Role members retrieved successfully",
    type: RoleMemberResponse,
    isPaginated: true,
    allowedSortFields: ["assignedAt"],
  })
  @ApiOperation({
    summary: "Get role members",
    description:
      "Retrieve users assigned to a campus-scoped role with profile and provenance metadata. Requires role.read or role.assign in the campus context.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async getMembers(
    @Param("id") id: string,
    @CampusContext() campusId: string,
    @Query() query: StandardRequestDto,
  ) {
    const normalizedId = id.toLowerCase();
    return this.getRoleMembersUseCase.execute({
      roleId: normalizedId,
      campusId,
      params: query,
    });
  }

  @Post(":id/users")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.assign")
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
  @UseGuards(PermissionsGuard)
  @Permissions("role.assign")
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

  @Post(":id/permissions")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.update")
  @StandardResponse({
    message: "Permissions assigned successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Assign permissions to role",
    description:
      "Add permissions to a campus-scoped role. Requires role.update. Duplicates are ignored and only actual additions are audited.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async assignPermissions(
    @Param("id") id: string,
    @Body() dto: AssignPermissionsRequest,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    await this.assignPermissionsToRoleUseCase.execute(
      {
        roleId: normalizedId,
        permissionIds: dto.permissionIds,
        campusId,
      },
      currentUser,
    );
  }

  @Put(":id/permissions")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.update")
  @StandardResponse({
    message: "Permissions replaced successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Replace role permissions",
    description:
      "Atomically replace the full permission set for a campus-scoped role. Requires role.update. The final permission ID set is fully validated before writes.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async replacePermissions(
    @Param("id") id: string,
    @Body() dto: ReplaceRolePermissionsRequest,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    await this.replaceRolePermissionsUseCase.execute(
      {
        roleId: normalizedId,
        permissionIds: dto.permissionIds,
        campusId,
      },
      currentUser,
    );
  }

  @Delete(":id/permissions")
  @RequireCampusAccess()
  @UseGuards(PermissionsGuard)
  @Permissions("role.update")
  @StandardResponse({
    message: "Permissions removed successfully",
    type: null,
  })
  @ApiOperation({
    summary: "Remove permissions from role",
    description:
      "Remove permissions from a campus-scoped role. Requires role.update. Missing role-permission rows are ignored and only actual removals are audited.",
  })
  @ApiHeader({
    name: CAMPUS_ID_HEADER,
    description: "Campus UUID — the role must belong to this campus",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async removePermissions(
    @Param("id") id: string,
    @Body() dto: AssignPermissionsRequest,
    @CampusContext() campusId: string,
    @CurrentUser() currentUser: User,
  ) {
    const normalizedId = id.toLowerCase();
    await this.removePermissionsFromRoleUseCase.execute(
      {
        roleId: normalizedId,
        permissionIds: dto.permissionIds,
        campusId,
      },
      currentUser,
    );
  }
}
