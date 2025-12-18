import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";
import {
  IsE164Phone,
  IsDateOfBirth,
  TransformToUTCDate,
} from "@/core/validators";

export class UpdateStudentRequest {
  @ApiPropertyOptional({
    description: "Student full name",
    example: "Nguyen Van A",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description: "Student nickname",
    example: "Be A",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiPropertyOptional({
    description:
      "Student date of birth in ISO 8601 format (must be in the past)",
    example: "2018-05-15T00:00:00.000Z",
  })
  @IsOptional()
  @TransformToUTCDate()
  @IsDateOfBirth()
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    description: "Student gender",
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender?: Gender;

  @ApiPropertyOptional({
    description: "Student phone number in E.164 format",
    example: "+84912345678",
  })
  @IsOptional()
  @IsString()
  @IsE164Phone()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description: "Student email address",
    example: "student@example.com",
  })
  @IsOptional()
  @IsEmail({}, { message: "Invalid email format" })
  email?: string;

  @ApiPropertyOptional({
    description: "Student address",
    example: "123 ABC Street, District 1, HCMC",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: "Student status",
    enum: StudentStatus,
    example: StudentStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(StudentStatus, {
    message:
      "Status must be DROPPED, ACTIVE, GRADUATED, TRIAL, WAITING, or DEFERRED",
  })
  status?: StudentStatus;
}
