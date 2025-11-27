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
import { CreateStudentRequest, StudentResponse } from '../../dtos/user-management/student';
import { StandardRequestDto } from '@/core/modules/standard-response/dto/standard-request.dto';

// Mappers
import { StudentInputMapper } from '../../mappers/student-input.mapper';

// Use Cases
import { CreateStudentUseCase } from '@/application/user-management/use-cases/student/create-student.use-case';
import { GetAllStudentsUseCase } from '@/application/user-management/use-cases/student/get-all-students.use-case';

@Controller('students')
@ApiTags('Students')
@ApiBearerAuth('JWT')
@UseGuards(ClerkAuthGuard)
export class StudentController {
  constructor(
    private readonly createStudentUseCase: CreateStudentUseCase,
    private readonly getAllStudentsUseCase: GetAllStudentsUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: 'Student created successfully',
    type: StudentResponse,
  })
  @ApiOperation({
    summary: 'Create a new student',
    description:
      'Creates a new student with person information, class assignment, and optional parent assignment. Can also create user account with Clerk if requested.',
  })
  async create(@Body() dto: CreateStudentRequest) {
    const input = StudentInputMapper.toCreateInput(dto);
    return await this.createStudentUseCase.execute(input);
  }

  @Get()
  @StandardResponse({
    message: 'Students retrieved successfully',
    type: StudentResponse,
    isArray: true,
  })
  @ApiOperation({
    summary: 'Get all students',
    description:
      'Retrieve all students with advanced filtering, sorting, and pagination. Supports filtering by fullName, nickname, classId, gender, isOnTrack, enrollmentDate. Use filter parameter for complex queries with operators (eq, ne, gt, gte, lt, lte, like, ilike, in, not_in, between).',
  })
  async findAll(@Query() query: StandardRequestDto) {
    return await this.getAllStudentsUseCase.execute(query);
  }
}
