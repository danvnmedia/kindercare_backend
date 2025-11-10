import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { StandardResponse } from '@/core/modules/standard-response/decorators/standard-response.decorator';

// DTOs
import { CreateUserDto } from '../../dtos/user-management/create-user.dto';
import { UpdateUserDto } from '../../dtos/user-management/update-user.dto';
import { UserResponseDto } from '../../dtos/user-management/user-response.dto';
import { AssignRolesDto } from '../../dtos/user-management/assign-roles.dto';
import { UserQueryDto } from '../../dtos/user-management/user-query.dto';

// Use Cases
import { CreateUserUseCase } from '@/application/user-management/use-cases/user/create-user.use-case';
import { GetUserByIdUseCase } from '@/application/user-management/use-cases/user/get-user-by-id.use-case';
import { GetAllUsersUseCase } from '@/application/user-management/use-cases/user/get-all-users.use-case';
import { UpdateUserUseCase } from '@/application/user-management/use-cases/user/update-user.use-case';
import { DeleteUserUseCase } from '@/application/user-management/use-cases/user/delete-user.use-case';
import { AssignRolesToUserUseCase } from '@/application/user-management/use-cases/user/assign-roles-to-user.use-case';
import { RemoveRolesFromUserUseCase } from '@/application/user-management/use-cases/user/remove-roles-from-user.use-case';

@Controller('api/v2/users')
@ApiTags('Users (v2 - Clean Architecture)')
export class UserController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUserByIdUseCase: GetUserByIdUseCase,
    private readonly getAllUsersUseCase: GetAllUsersUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
    private readonly assignRolesToUserUseCase: AssignRolesToUserUseCase,
    private readonly removeRolesFromUserUseCase: RemoveRolesFromUserUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: 'User created successfully',
    type: UserResponseDto,
  })
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a new user and provisions them in Clerk authentication system',
  })
  async create(@Body() dto: CreateUserDto) {
    return await this.createUserUseCase.execute(dto);
  }

  @Get()
  @StandardResponse({
    message: 'Users retrieved successfully',
    type: UserResponseDto,
    isArray: true,
  })
  @ApiOperation({
    summary: 'Get all users',
    description: 'Retrieve all users with filtering, sorting, and pagination',
  })
  async findAll(@Query() query: UserQueryDto) {
    return await this.getAllUsersUseCase.execute(query);
  }

  @Get(':id')
  @StandardResponse({
    message: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve a single user by their ID',
  })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.getUserByIdUseCase.execute(id);
  }

  @Patch(':id')
  @StandardResponse({
    message: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiOperation({
    summary: 'Update user',
    description: 'Update user information and sync with Clerk',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return await this.updateUserUseCase.execute(id, dto);
  }

  @Delete(':id')
  @StandardResponse({
    message: 'User deleted successfully',
    type: null,
  })
  @ApiOperation({
    summary: 'Delete user',
    description: 'Delete user from database and Clerk authentication system',
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.deleteUserUseCase.execute(id);
  }

  @Post(':id/roles')
  @StandardResponse({
    message: 'Roles assigned successfully',
    type: UserResponseDto,
  })
  @ApiOperation({
    summary: 'Assign roles to user',
    description: 'Assign multiple roles to a user',
  })
  async assignRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto,
  ) {
    return await this.assignRolesToUserUseCase.execute(id, dto.roleIds);
  }

  @Delete(':id/roles')
  @StandardResponse({
    message: 'Roles removed successfully',
    type: UserResponseDto,
  })
  @ApiOperation({
    summary: 'Remove roles from user',
    description: 'Remove multiple roles from a user',
  })
  async removeRoles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignRolesDto,
  ) {
    return await this.removeRolesFromUserUseCase.execute(id, dto.roleIds);
  }
}
