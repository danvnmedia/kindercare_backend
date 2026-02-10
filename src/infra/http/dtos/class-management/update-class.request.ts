import { ApiProperty } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateClassRequest {
  @ApiProperty({
    description: "Class name",
    example: "Lớp A1",
    minLength: 1,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiProperty({
    description: "Class description",
    example: "Lớp Mầm A1 - Năm học 2024-2025",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: "Grade level ID to assign to this class",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;
}
