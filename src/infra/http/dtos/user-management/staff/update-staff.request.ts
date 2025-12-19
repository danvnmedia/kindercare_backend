import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";
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
    description: "Staff type (TEACHER, NURSE, PRINCIPAL, STAFF)",
    enum: StaffType,
    example: StaffType.TEACHER,
    required: false,
  })
  @IsOptional()
  @IsEnum(StaffType, {
    message: "Staff type must be TEACHER, NURSE, PRINCIPAL, or STAFF",
  })
  staffType?: StaffType;

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
