import { Controller, Get, Post, Body, Param, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { StandardResponse, StandardRequestParam, StandardRequest } from '@/core/modules/standard-response';
import { CreateUserUseCase, GetAllUsersUseCase, GetUserByIdUseCase } from '@/application/user-management/use-cases';
import { CreateUserDto, UserResponseDto } from '../dtos/user.dto';
import { createStandardResponseClass } from '@/core/modules/standard-response/dto/standard-response.dto';

@ApiTags('Users')
@Controller('users')
export class UserController {
    constructor(
        private readonly createUserUseCase: CreateUserUseCase,
        private readonly getAllUsersUseCase: GetAllUsersUseCase,
        private readonly getUserByIdUseCase: GetUserByIdUseCase,
    ) {}

    @Post()
    @ApiOperation({ summary: 'Create a new user' })
    @ApiResponse({
        status: HttpStatus.CREATED,
        description: 'User created successfully',
        type: createStandardResponseClass(UserResponseDto),
    })
    @StandardResponse({
        message: 'User created successfully',
        type: UserResponseDto,
    })
    async createUser(@Body() createUserDto: CreateUserDto) {
        return await this.createUserUseCase.execute(createUserDto);
    }

    @Get('/')
    @StandardResponse({
        type: UserResponseDto,
        isPaginated: true,
        message: 'Users retrieved successfully',
        allowedSortFields: ['id', 'name', 'email', 'createdAt', 'updatedAt'],
        allowedFilterFields: ['name', 'email'],
        defaultLimit: 10,
        maxLimit: 100
    })
    @ApiOperation({
        summary: 'Get all users',
        description: 'Retrieve a list of all users with pagination support.'
    })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Invalid request parameters',
    })
    @ApiResponse({
        status: HttpStatus.NOT_FOUND,
        description: 'No users found',
    })
    async getAllUsers(
        @StandardRequestParam() params: StandardRequest
    ) {
        return this.getAllUsersUseCase.execute(params);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get user by ID' })
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'User retrieved successfully',
        type: createStandardResponseClass(UserResponseDto),
    })
    @StandardResponse({
        message: 'User retrieved successfully',
        type: UserResponseDto,
    })
    async getUserById(@Param('id') id: string) {
        const user = await this.getUserByIdUseCase.execute(id);
        
        if (!user) {
            throw new Error('User not found');
        }
        
        return user;
    }
}