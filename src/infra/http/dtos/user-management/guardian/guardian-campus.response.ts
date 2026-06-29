import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class GuardianCampusResponse {
  @Expose()
  @ApiProperty({
    description: "Campus ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Campus name",
    example: "Main Campus",
  })
  name: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Campus address",
    example: "123 Main Street, City, Country",
    nullable: true,
  })
  address: string | null;

  @Expose()
  @ApiPropertyOptional({
    description: "Campus phone number",
    example: "+84901234567",
    nullable: true,
  })
  phoneNumber: string | null;
}
