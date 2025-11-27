import { ApiProperty } from '@nestjs/swagger';
import { RoleResponse } from '../user-management/role';
import { Expose, Type } from 'class-transformer';

/**
 * Profile Info DTO
 * Personal information from Parent or Teacher profile
 */
export class ProfileInfo {
  @Expose()
  @ApiProperty({ example: 'parent' })
  type: 'parent' | 'teacher';

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @Expose()
  @ApiProperty({ example: 'user@example.com', nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ example: '+84912345678', nullable: true })
  phoneNumber: string | null;

  @Expose()
  @ApiProperty({ example: '1985-03-20T00:00:00.000Z', nullable: true })
  dateOfBirth: Date | null;

  @Expose()
  @ApiProperty({ example: 'MALE', nullable: true })
  gender: string | null;
}

/**
 * Auth Me Response
 *
 * Response for /auth/me endpoint.
 * Returns authenticated user information with roles and profile.
 */
export class AuthMeResponse {
  @Expose()
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User unique identifier (UUID)',
  })
  id: string;

  @Expose()
  @ApiProperty({
    example: 'user_2abc123xyz',
    description: 'Clerk user ID',
  })
  clerkUid: string;

  @Expose()
  @ApiProperty({
    example: true,
    description: 'Whether the user account is active',
  })
  isActive: boolean;

  @Expose()
  @Type(() => RoleResponse)
  @ApiProperty({
    type: [RoleResponse],
    description: 'User roles with permissions',
  })
  roles: RoleResponse[];

  @Expose()
  @Type(() => ProfileInfo)
  @ApiProperty({
    type: ProfileInfo,
    description: 'User profile information (from Parent or Teacher)',
    nullable: true,
  })
  profile: ProfileInfo | null;

  @Expose()
  @ApiProperty({
    example: '2024-11-14T10:30:00.000Z',
    description: 'Account creation timestamp',
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    example: '2024-11-14T15:45:00.000Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
