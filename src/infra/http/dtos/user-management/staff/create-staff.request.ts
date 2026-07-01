import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  IsE164Phone,
  IsAdultDateOfBirth,
  TransformToUTCDate,
} from "@/core/validators";

export class CreateStaffRequest {
  // ========== Personal Information ==========

  @ApiProperty({
    description: "Staff full name",
    example: "Nguyễn Văn A",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: "Staff email (required for account creation)",
    example: "staff@example.com",
  })
  @IsNotEmpty()
  @IsEmail({}, { message: "Invalid email format" })
  email: string;

  @ApiProperty({
    description: "Staff phone number (required)",
    example: "+84912345678",
  })
  @IsNotEmpty()
  @IsString()
  @IsE164Phone()
  phoneNumber: string;

  @ApiProperty({
    description: "Staff gender",
    enum: Gender,
    example: Gender.MALE,
  })
  @IsNotEmpty()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender: Gender;

  @ApiProperty({
    description:
      "Staff type IDs (references staff_type table). Min 1, no max (per D3 of @doc/specs/staff-multi-type-refactor). A staff can hold multiple concurrent types.",
    type: String,
    isArray: true,
    example: [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
    ],
  })
  @IsArray()
  @ArrayMinSize(1, { message: "Staff must have at least one staff type" })
  @IsUUID("4", {
    each: true,
    message: "Each staff type ID must be a valid UUID",
  })
  staffTypeIds: string[];

  // ========== Optional Information ==========

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
    description:
      "Staff date of birth in ISO 8601 format (must be 18+ years old)",
    example: "1990-01-15T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @TransformToUTCDate()
  @IsAdultDateOfBirth()
  dateOfBirth?: Date;
}
