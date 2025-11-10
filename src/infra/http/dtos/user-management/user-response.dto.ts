import { ApiProperty } from '@nestjs/swagger';
import { RoleResponseDto } from './role-response.dto';

export class UserResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'user@kindercare.com' })
  email: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  fullName: string;

  @ApiProperty({ example: '0912345678', required: false })
  phoneNumber?: string;

  @ApiProperty({ example: 'user_2abc123def456' })
  clerkUid: string;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ type: [RoleResponseDto], required: false })
  roles?: RoleResponseDto[];

  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  updatedAt: Date;
}
