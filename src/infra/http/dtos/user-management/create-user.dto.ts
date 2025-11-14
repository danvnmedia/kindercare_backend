import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@kindercare.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'User full name',
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
    description: 'Phone number in E.164 format (Vietnamese: +84 followed by 9-10 digits)',
    example: '+84912345678',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+84\d{9,10}$/, { message: 'Phone number must be in E.164 format (e.g., +84912345678)' })
  phoneNumber?: string;

  @ApiProperty({
    description: 'User address',
    example: '123 Đường ABC, Quận 1, TP.HCM',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description: 'User date of birth',
    example: '1990-05-15',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: Date;

  @ApiProperty({
    description: 'Additional information about the user',
    example: 'Parent of student Nguyễn Văn B',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  additionalInfo?: string;

  @ApiProperty({
    description: 'User active status',
    example: true,
    required: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
