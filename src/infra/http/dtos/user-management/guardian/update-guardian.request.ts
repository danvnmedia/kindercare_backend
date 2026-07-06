import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import {
  IsE164Phone,
  IsAdultDateOfBirth,
  TransformToUTCDate,
} from "@/core/validators";

export class UpdateGuardianRequest {
  // ========== Personal Information ==========

  @ApiPropertyOptional({
    description:
      "Guardian full name. Rejected for linked guardian identities; use a dedicated identity-change flow.",
    example: "Nguyễn Thị B",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({
    description:
      "Guardian date of birth in ISO 8601 format (must be 18+ years old)",
    example: "1985-03-20T00:00:00.000Z",
  })
  @IsOptional()
  @TransformToUTCDate()
  @IsAdultDateOfBirth()
  dateOfBirth?: Date;

  @ApiPropertyOptional({
    description: "Guardian gender",
    enum: Gender,
    example: Gender.FEMALE,
  })
  @IsOptional()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender?: Gender;

  @ApiPropertyOptional({
    description:
      "Guardian phone number. Rejected for linked guardian identities; use a dedicated identity-change flow.",
    example: "+84912345678",
  })
  @IsOptional()
  @IsString()
  @IsE164Phone()
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      "Guardian email. Rejected for linked guardian identities; use a dedicated identity-change flow.",
    example: "guardian@example.com",
  })
  @ValidateIf((o) => o.email !== undefined)
  @IsEmail({}, { message: "Invalid email format" })
  email?: string;

  @ApiPropertyOptional({
    description: "Guardian address",
    example: "123 Đường ABC, Quận 1, TP.HCM",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  // ========== Guardian-Specific Information ==========

  @ApiPropertyOptional({
    description: "Guardian occupation/job title",
    example: "Software Engineer",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  occupation?: string;

  @ApiPropertyOptional({
    description: "Guardian work address",
    example: "456 Đường XYZ, Quận 3, TP.HCM",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  workAddress?: string;
}
