import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  MinLength,
  Matches,
} from "class-validator";

export class CreateCampusRequest {
  @ApiProperty({
    description: "Campus name",
    example: "Main Campus",
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: "Campus address",
    example: "123 Main Street, City, Country",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description: "Campus phone number in E.164 format",
    example: "+84901234567",
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: "Phone number must be in E.164 format (e.g., +84901234567)",
  })
  phoneNumber?: string;

  @ApiProperty({
    description:
      "Required IANA timezone used for campus-local schedules and lifecycle boundaries; missing or invalid values are rejected.",
    example: "Asia/Ho_Chi_Minh",
  })
  @IsString()
  @IsNotEmpty()
  @IsTimeZone({ message: "timeZone must be a valid IANA timezone" })
  timeZone: string;

  @ApiPropertyOptional({
    description: "Whether the campus is archived",
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;
}
