import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { StandardResponse } from '@/core/modules/standard-response/decorators/standard-response.decorator';
import { ClerkAuthGuard } from '../../guards/clerk-auth.guard';

// DTOs
import { CreateParentRequest, ParentResponse } from '../../dtos/user-management/parent';
import { StandardRequestDto } from '@/core/modules/standard-response/dto/standard-request.dto';

// Mappers
import { ParentInputMapper } from '../../mappers/parent-input.mapper';

// Use Cases
import { CreateParentUseCase } from '@/application/user-management/use-cases/parent/create-parent.use-case';
import { GetAllParentsUseCase } from '@/application/user-management/use-cases/parent/get-all-parents.use-case';

@Controller('parents')
@ApiTags('Parents')
// @ApiBearerAuth('JWT')
// @UseGuards(ClerkAuthGuard)
export class ParentController {
  constructor(
    private readonly createParentUseCase: CreateParentUseCase,
    private readonly getAllParentsUseCase: GetAllParentsUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: 'Parent created successfully',
    type: ParentResponse,
  })
  @ApiOperation({
    summary: 'Create a new parent',
    description:
      'Creates a new parent with person information and automatically creates a Clerk account with weak password (ChangeMe123!) that forces password reset on first login.',
  })
  async create(@Body() dto: CreateParentRequest) {
    const input = ParentInputMapper.toCreateInput(dto);
    return await this.createParentUseCase.execute(input);
  }

  @Get()
  @StandardResponse({
    message: 'Parents retrieved successfully',
    type: ParentResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: 'Get all parents',
    description:
      'Retrieve all parents with advanced filtering, sorting, and pagination. Supports filtering by fullName, occupation, workAddress. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).',
  })
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllParentsUseCase.execute(query);
  }
}
