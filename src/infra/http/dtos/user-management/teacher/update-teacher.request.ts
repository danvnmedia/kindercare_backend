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
import { TeacherType } from "@/domain/user-management/enums/teacher-type.enum";
import { IsAdultDateOfBirth } from "@/core/validators";

export class UpdateTeacherRequest {
  @ApiProperty({
    description: "Teacher full name",
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
    description: "Teacher type (TEACHER, NURSE, PRINCIPAL, STAFF)",
    enum: TeacherType,
    example: TeacherType.TEACHER,
    required: false,
  })
  @IsOptional()
  @IsEnum(TeacherType, {
    message: "Teacher type must be TEACHER, NURSE, PRINCIPAL, or STAFF",
  })
  teacherType?: TeacherType;

  @ApiProperty({
    description: "Teacher address",
    example: "123 Đường ABC, Quận 1, TP.HCM",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiProperty({
    description: "Teacher date of birth (must be 18+ years old)",
    example: "1990-01-15",
    required: false,
  })
  @IsOptional()
  @IsAdultDateOfBirth()
  dateOfBirth?: Date;

  @ApiProperty({
    description: "Teacher gender",
    enum: Gender,
    example: Gender.MALE,
    required: false,
  })
  @IsOptional()
  @IsEnum(Gender, { message: "Gender must be MALE, FEMALE, or OTHER" })
  gender?: Gender;

  @ApiProperty({
    description: "Teacher start date (employment start)",
    example: "2024-01-01",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: Date;
}
