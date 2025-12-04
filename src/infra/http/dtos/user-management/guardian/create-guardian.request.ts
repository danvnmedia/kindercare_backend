import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Gender } from '../shared/gender.enum';

export class CreateGuardianRequest {
  // ========== Personal Information ==========

  @ApiProperty({
    description: 'Guardian full name',
    example: 'Nguyễn Thị B',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: 'Guardian date of birth',
    example: '1985-03-20',
  })
  @IsNotEmpty()
  @IsDateString()
  dateOfBirth: Date;

  @ApiProperty({
    description: 'Guardian gender',
    enum: Gender,
    example: Gender.FEMALE,
  })
  @IsNotEmpty()
  @IsEnum(Gender, { message: 'Gender must be MALE, FEMALE, or OTHER' })
  gender: Gender;

  @ApiProperty({
    description: 'Guardian phone number (required)',
    example: '+84912345678',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\+84\d{9,10}$/, {
    message: 'Phone number must be in E.164 format (e.g., +84912345678)',
  })
  phoneNumber: string;

  @ApiProperty({
    description: 'Guardian email (required for account creation)',
    example: 'guardian@example.com',
  })
  @IsNotEmpty()
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  @ApiProperty({
    description: 'Guardian address',
    example: '123 Đường ABC, Quận 1, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // ========== Guardian-Specific Information ==========

  @ApiProperty({
    description: 'Guardian occupation/job title',
    example: 'Software Engineer',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiProperty({
    description: 'Guardian work address',
    example: '456 Đường XYZ, Quận 3, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  workAddress?: string;
}
