import { ApiProperty } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
import {
  IsE164Phone,
  IsAdultDateOfBirth,
  TransformToUTCDate,
  IsISO8601Date,
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
    description: "Staff type (TEACHER, NURSE, PRINCIPAL, STAFF)",
    enum: StaffType,
    example: StaffType.TEACHER,
  })
  @IsNotEmpty()
  @IsEnum(StaffType, {
    message: "Staff type must be TEACHER, NURSE, PRINCIPAL, or STAFF",
  })
  staffType: StaffType;

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
    description: "Staff start date in ISO 8601 format (employment start)",
    example: "2024-01-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @TransformToUTCDate()
  @IsISO8601Date()
  startDate?: Date;
}
