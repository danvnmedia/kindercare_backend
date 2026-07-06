import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { IsAdultDateOfBirth, IsE164Phone } from "@/core/validators";

export class UpdateStaffRequest {
  @ApiProperty({
    description:
      "Staff full name. Rejected for linked staff identities; use a dedicated identity-change flow.",
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
    description:
      "Staff email. Rejected for linked staff identities; use a dedicated identity-change flow.",
    example: "staff@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Invalid email format" })
  email?: string;

  @ApiProperty({
    description:
      "Staff phone number in E.164 format. Rejected for linked staff identities; use a dedicated identity-change flow.",
    example: "+84912345678",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsE164Phone()
  phoneNumber?: string;

  @ApiProperty({
    description:
      "Staff type IDs — when present, performs a full-set replacement of the staff's types (min 1, no max). Omit the field entirely to leave types unchanged. See @doc/specs/staff-multi-type-refactor (D1, D3, D4).",
    type: String,
    isArray: true,
    example: [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
    ],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: "Staff must have at least one staff type" })
  @IsUUID("4", {
    each: true,
    message: "Each staff type ID must be a valid UUID",
  })
  staffTypeIds?: string[];

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

}
