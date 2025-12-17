import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
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
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";
import { IsE164Phone, IsDateOfBirth, TransformToUTCDate } from "@/core/validators";

export class CreateStudentRequest {
  // ========== Personal Information ==========

  @ApiProperty({
    description: "Student full name",
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
    description: "Student nickname/biệt danh (optional)",
    example: "Bé A",
    required: false,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiProperty({
    description:
      "Student date of birth in ISO 8601 format (optional, must be in the past)",
    example: "2018-05-15T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @TransformToUTCDate()
  @IsDateOfBirth()
  dateOfBirth?: Date;

  @ApiProperty({
    description: "Student gender (optional)",
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender?: Gender;

  @ApiProperty({
    description: "Student phone number (optional, for older students)",
    example: "+84912345678",
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsE164Phone()
  phoneNumber?: string;

  @ApiProperty({
    description: "Student email (optional, for older students)",
    example: "student@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Invalid email format" })
  email?: string;

  @ApiProperty({
    description: "Student address",
    example: "123 Đường ABC, Quận 1, TP.HCM",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // ========== Student-Specific Information ==========

  @ApiProperty({
    description: "Student status",
    enum: StudentStatus,
    example: StudentStatus.WAITING,
    default: StudentStatus.WAITING,
    required: false,
  })
  @IsOptional()
  @IsEnum(StudentStatus, {
    message: "Status must be DROPPED, ACTIVE, GRADUATED, TRIAL, WAITING, or DEFERRED",
  })
  status?: StudentStatus;

  @ApiProperty({
    description:
      "Create user account for student (will create User + Clerk account)",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  createUserAccount?: boolean;

  // ========== Guardian Assignment ==========

  @ApiProperty({
    description: "Array of guardian IDs to assign to student",
    example: [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
    ],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true, message: "Each guardian ID must be a valid UUID" })
  guardianIds?: string[];
}
