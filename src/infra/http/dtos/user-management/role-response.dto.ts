import { ApiProperty } from '@nestjs/swagger';

export class RoleResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'ADMIN' })
  name: string;

  @ApiProperty({ example: 'Administrator with full access' })
  description?: string;

  @ApiProperty({
    example: { users: ['create', 'read', 'update', 'delete'] },
  })
  permissions: Record<string, any>;

  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  updatedAt: Date;
}
