import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateRoleRequest {
  @ApiPropertyOptional({
    description: "Role name (unique within campus scope)",
    example: "Campus Admin",
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    description: "Role description",
    example: "Administrator for a specific campus",
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

}
