import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RoleResponse {
  @Expose()
  @ApiProperty({ example: 'admin' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'ADMIN' })
  name: string;

  @Expose()
  @ApiProperty({ example: 'Administrator with full access' })
  description?: string;

  @Expose()
  @ApiProperty({
    example: { users: ['create', 'read', 'update', 'delete'] },
  })
  permissions: Record<string, any>;

  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;

  @Expose()
  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  updatedAt: Date;
}
