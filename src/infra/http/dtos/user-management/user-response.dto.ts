import { ApiProperty } from '@nestjs/swagger';
import { RoleResponseDto } from './role-response.dto';
import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsString, IsUUID } from 'class-validator';

export class UserResponseDto {
  @IsUUID()
  @Expose()
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'User ID (UUID)' })
  id: string;

  @IsEmail()
  @Expose()
  @ApiProperty({ example: 'user@kindercare.com' })
  email: string;

  @IsString()
  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @IsString()
  @Expose()
  @ApiProperty({ example: '+84912345678', required: false, description: 'Phone number in E.164 format' })
  phoneNumber?: string;

  @IsString()
  @Expose()
  @ApiProperty({ example: 'user_2abc123def456' })
  clerkUid: string;

  @IsBoolean()
  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;

  @Type(() => RoleResponseDto)
  @Expose()
  @ApiProperty({ type: [RoleResponseDto], required: false })
  roles?: RoleResponseDto[];

  @IsDateString()
  @Expose()
  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  createdAt: Date;

  @IsDateString()
  @Expose()
  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  updatedAt: Date;
}
