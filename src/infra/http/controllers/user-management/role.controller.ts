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
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StandardResponse } from '@/core/modules/standard-response/decorators/standard-response.decorator';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

// DTOs
import { CreateRoleDto } from '../../dtos/user-management/create-role.dto';
import { UpdateRoleDto } from '../../dtos/user-management/update-role.dto';
import { RoleResponseDto } from '../../dtos/user-management/role-response.dto';
import { AssignUsersDto } from '../../dtos/user-management/assign-users.dto';
import { RoleQueryDto } from '../../dtos/user-management/role-query.dto';

// Use Cases
import { CreateRoleUseCase } from '@/application/user-management/use-cases/role/create-role.use-case';
import { GetRoleByIdUseCase } from '@/application/user-management/use-cases/role/get-role-by-id.use-case';
import { GetAllRolesUseCase } from '@/application/user-management/use-cases/role/get-all-roles.use-case';
import { UpdateRoleUseCase } from '@/application/user-management/use-cases/role/update-role.use-case';
import { DeleteRoleUseCase } from '@/application/user-management/use-cases/role/delete-role.use-case';
import { AssignUsersToRoleUseCase } from '@/application/user-management/use-cases/role/assign-users-to-role.use-case';
import { RemoveUsersFromRoleUseCase } from '@/application/user-management/use-cases/role/remove-users-from-role.use-case';

@Controller('roles')
@ApiTags('Roles')
@ApiBearerAuth('JWT')
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
  ) {}

  @Post()
  @StandardResponse({
    message: 'Role created successfully',
    type: RoleResponseDto,
  })
  @ApiOperation({
    summary: 'Create a new role',
    description: 'Create a new role with permissions',
  })
  async create(@Body() dto: CreateRoleDto) {
    return await this.createRoleUseCase.execute(dto);
  }

  @Get()
  @StandardResponse({
    message: 'Roles retrieved successfully',
    type: RoleResponseDto,
    isArray: true,
  })
  @ApiOperation({
    summary: 'Get all roles',
    description: 'Retrieve all roles with filtering, sorting, and pagination',
  })
  async findAll(@Query() query: RoleQueryDto) {
    return await this.getAllRolesUseCase.execute(query);
  }

  @Get(':id')
  @StandardResponse({
    message: 'Role retrieved successfully',
    type: RoleResponseDto,
  })
  @ApiOperation({
    summary: 'Get role by ID',
    description: 'Retrieve a single role by its ID',
  })
  async findOne(@Param('id') id: string) {
    const normalizedId = id.toLowerCase();
    return await this.getRoleByIdUseCase.execute(normalizedId);
  }

  @Patch(':id')
  @StandardResponse({
    message: 'Role updated successfully',
    type: RoleResponseDto,
  })
  @ApiOperation({
    summary: 'Update role',
    description: 'Update role information and permissions',
  })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const normalizedId = id.toLowerCase();
    return await this.updateRoleUseCase.execute(normalizedId, dto);
  }

  @Delete(':id')
  @StandardResponse({
    message: 'Role deleted successfully',
    type: null,
  })
  @ApiOperation({
    summary: 'Delete role',
    description: 'Delete a role from the system',
  })
  async remove(@Param('id') id: string) {
    const normalizedId = id.toLowerCase();
    await this.deleteRoleUseCase.execute(normalizedId);
  }

  @Post(':id/users')
  @StandardResponse({
    message: 'Users assigned successfully',
    type: RoleResponseDto,
  })
  @ApiOperation({
    summary: 'Assign users to role',
    description: 'Assign multiple users to a role',
  })
  async assignUsers(
    @Param('id') id: string,
    @Body() dto: AssignUsersDto,
  ) {
    const normalizedId = id.toLowerCase();
    return await this.assignUsersToRoleUseCase.execute(normalizedId, dto.userIds);
  }

  @Delete(':id/users')
  @StandardResponse({
    message: 'Users removed successfully',
    type: RoleResponseDto,
  })
  @ApiOperation({
    summary: 'Remove users from role',
    description: 'Remove multiple users from a role',
  })
  async removeUsers(
    @Param('id') id: string,
    @Body() dto: AssignUsersDto,
  ) {
    const normalizedId = id.toLowerCase();
    return await this.removeUsersFromRoleUseCase.execute(normalizedId, dto.userIds);
  }
}
