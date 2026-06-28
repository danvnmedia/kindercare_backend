import { ApiProperty } from "@nestjs/swagger";
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

export class EnrollStudentRequest {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiProperty({
    description: "Enrollment date",
    example: "2024-09-01",
  })
  @IsNotEmpty()
  @IsDateString()
  enrollmentDate: Date;

  @ApiProperty({
    description: "Enrollment note",
    example: "Enrolled at start of school year",
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
