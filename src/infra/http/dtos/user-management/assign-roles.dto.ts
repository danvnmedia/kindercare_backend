import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, Matches } from 'class-validator';

export class AssignRolesDto {
  @ApiProperty({
    description: 'Array of role IDs to assign',
    example: ['admin', 'teacher'],
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.map((roleId) => String(roleId).trim().toLowerCase())
      : value,
  )
  @IsString({ each: true })
  @Matches(/^[a-z0-9_]+$/, { each: true, message: 'Role ID must be lowercase alphanumeric with underscores only' })
  roleIds: string[];
}
