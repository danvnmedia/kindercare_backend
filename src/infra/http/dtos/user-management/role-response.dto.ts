import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { IsBoolean, IsDateString, IsObject, IsOptional, IsString } from 'class-validator';

export class RoleResponseDto {
  @IsString()
  @Expose()
  @ApiProperty({ example: 'admin' })
  id: string;

  @IsString()
  @Expose()
  @ApiProperty({ example: 'ADMIN' })
  name: string;

  @IsString()
  @IsOptional()
  @Expose()
  @ApiProperty({ example: 'Administrator with full access' })
  description?: string;

  @IsObject()
  @Expose()
  @ApiProperty({
    example: { users: ['create', 'read', 'update', 'delete'] },
  })
  permissions: Record<string, any>;

  @IsBoolean()
  @Expose()
  @ApiProperty({ example: true })
  isActive: boolean;

  @IsDateString()
  @Expose()
  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  createdAt: Date;

  @IsDateString()
  @Expose()
  @ApiProperty({ example: '2025-11-01T00:00:00.000Z' })
  updatedAt: Date;
}
