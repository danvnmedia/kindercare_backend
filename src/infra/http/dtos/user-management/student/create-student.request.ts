import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender } from '../shared/gender.enum';
import { StudentStatus } from '../shared/student-status.enum';

export class CreateStudentRequest {
  // ========== Personal Information ==========

  @ApiProperty({
    description: 'Student full name',
    example: 'Nguyễn Văn A',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: 'Student nickname/biệt danh (optional)',
    example: 'Bé A',
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiProperty({
    description: 'Student date of birth (optional)',
    example: '2018-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiProperty({
    description: 'Student gender (optional)',
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: 'Gender must be MALE, FEMALE, or OTHER' })
  gender?: Gender;

  @ApiProperty({
    description: 'Student phone number (optional, for older students)',
    example: '+84912345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+84\d{9,10}$/, {
    message: 'Phone number must be in E.164 format (e.g., +84912345678)',
  })
  phoneNumber?: string;

  @ApiProperty({
    description: 'Student email (optional, for older students)',
    example: 'student@example.com',
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiProperty({
    description: 'Student address',
    example: '123 Đường ABC, Quận 1, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // ========== Student-Specific Information ==========

  @ApiProperty({
    description: 'Student status',
    enum: StudentStatus,
    example: StudentStatus.WAITING,
    default: StudentStatus.WAITING,
    required: false,
  })
  @IsOptional()
  @IsEnum(StudentStatus, { message: 'Status must be WAITING, ACTIVE, INACTIVE, or GRADUATED' })
  status?: StudentStatus;

  @ApiProperty({
    description: 'Create user account for student (will create User + Clerk account)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  createUserAccount?: boolean;

  // ========== Guardian Assignment ==========

  @ApiProperty({
    description: 'Array of guardian IDs to assign to student',
    example: ['123e4567-e89b-12d3-a456-426614174001', '123e4567-e89b-12d3-a456-426614174002'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true, message: 'Each guardian ID must be a valid UUID' })
  guardianIds?: string[];
}
