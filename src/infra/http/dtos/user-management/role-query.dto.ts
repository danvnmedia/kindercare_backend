import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';

export class RoleQueryDto extends StandardRequest {
  @ApiProperty({
    description: 'Filter by role name (partial match)',
    required: false,
    example: 'ADMIN',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
