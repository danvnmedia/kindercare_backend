import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { StandardRequest } from '@/core/modules/standard-response/dto/standard-request.dto';

export class UserQueryDto extends StandardRequest {
  @ApiProperty({
    description: 'Filter by email (partial match)',
    required: false,
    example: 'user@kindercare.com',
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({
    description: 'Filter by full name (partial match)',
    required: false,
    example: 'Nguyễn',
  })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({
    description: 'Filter by phone number',
    required: false,
    example: '0912345678',
  })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}
