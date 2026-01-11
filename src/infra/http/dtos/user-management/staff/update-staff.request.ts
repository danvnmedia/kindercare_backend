import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { IsAdultDateOfBirth } from "@/core/validators";

export class UpdateStaffRequest {
  @ApiProperty({
    description: "Staff full name",
    example: "Nguyễn Văn A",
    minLength: 2,
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiProperty({
    description: "Staff type ID (references staff_type table)",
    example: "123e4567-e89b-12d3-a456-426614174001",
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsUUID("4", { message: "Staff type ID must be a valid UUID" })
  staffTypeId?: string | null;

  @ApiProperty({
    description: "Staff address",
    example: "123 Đường ABC, Quận 1, TP.HCM",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description: "Staff date of birth (must be 18+ years old)",
    example: "1990-01-15",
    required: false,
  })
  @IsOptional()
  @IsAdultDateOfBirth()
  dateOfBirth?: Date;

  @ApiProperty({
    description: "Staff gender",
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender?: Gender;

  @ApiProperty({
    description: "Staff start date (employment start)",
    example: "2024-01-01",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date;
}
