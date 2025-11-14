import { ApiProperty } from '@nestjs/swagger';
import { RoleResponseDto } from '../user-management/role-response.dto';
import { Expose, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEmail, IsString, IsUUID } from 'class-validator';

/**
 * Auth Me Response DTO
 *
 * Response for /auth/me endpoint.
 * Returns authenticated user information with roles.
 */
export class AuthMeResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User unique identifier (UUID)',
  })
  @IsUUID()
  @Expose()
  id: string;

  @ApiProperty({
    example: 'user_2abc123xyz',
    description: 'Clerk user ID',
  })
  @IsString()
  @Expose()
  clerkUid: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'User email address',
    nullable: true,
  })
  @IsEmail()
  @Expose()
  email: string | null;

  @ApiProperty({
    example: 'John Doe',
    description: 'User full name',
  })
  @IsString()
  @Expose()
  fullName: string;

  @ApiProperty({
    example: '+84901234567',
    description: 'User phone number in E.164 format',
    nullable: true,
  })
  @IsString()
  @Expose()
  phoneNumber: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the user account is active',
  })
  @IsBoolean()
  @Expose()
  isActive: boolean;

  @ApiProperty({
    type: [RoleResponseDto],
    description: 'User roles with permissions',
  })
  @Type(() => RoleResponseDto)
  @Expose()
  roles: RoleResponseDto[];

  @ApiProperty({
    example: '2024-11-14T10:30:00.000Z',
    description: 'Account creation timestamp',
  })
  @IsDateString()
  @Expose()
  createdAt: Date;

  @ApiProperty({
    example: '2024-11-14T15:45:00.000Z',
    description: 'Last update timestamp',
  })
  @IsDateString()
  @Expose()
  updatedAt: Date;
}
