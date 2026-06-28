import { ApiProperty } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateClassRequest {
  @ApiProperty({
    description: "Class name",
    example: "Lớp A1",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  name: string;

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
    description: "Grade level ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsNotEmpty()
  @IsUUID()
  gradeLevelId: string;

  @ApiProperty({
    description: "School year ID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsNotEmpty()
  @IsUUID()
  schoolYearId: string;
}
