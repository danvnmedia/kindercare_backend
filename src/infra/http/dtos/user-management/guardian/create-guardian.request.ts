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
import {
  IsE164Phone,
  IsAdultDateOfBirth,
  TransformToUTCDate,
} from "@/core/validators";

export class CreateGuardianRequest {
  // ========== Personal Information ==========

  @ApiProperty({
    description: "Guardian full name",
    example: "Nguyễn Thị B",
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({
    description: "Guardian email (required for account creation)",
    example: "guardian@example.com",
  })
  @IsNotEmpty()
  @IsEmail({}, { message: "Invalid email format" })
  email: string;

  @ApiProperty({
    description: "Guardian phone number (required)",
    example: "+84912345678",
  })
  @IsNotEmpty()
  @IsString()
  @IsE164Phone()
  phoneNumber: string;

  @ApiProperty({
    description: "Guardian gender",
    enum: Gender,
    example: Gender.FEMALE,
  })
  @IsNotEmpty()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender: Gender;

  @ApiProperty({
    description:
      "Guardian date of birth in ISO 8601 format (must be 18+ years old when provided)",
    example: "1985-03-20T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @TransformToUTCDate()
  @IsAdultDateOfBirth()
  dateOfBirth?: Date;

  @ApiProperty({
    description: "Guardian address",
    example: "123 Đường ABC, Quận 1, TP.HCM",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // ========== Guardian-Specific Information ==========

  @ApiProperty({
    description: "Guardian occupation/job title",
    example: "Software Engineer",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiProperty({
    description: "Guardian work address",
    example: "456 Đường XYZ, Quận 3, TP.HCM",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  workAddress?: string;
}
