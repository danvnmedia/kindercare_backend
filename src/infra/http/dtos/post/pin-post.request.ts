import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsDate } from "class-validator";
import { Type } from "class-transformer";

export class PinPostRequest {
  @ApiProperty({
    description:
      "Optional expiration date for the pin. If not provided, the post remains pinned indefinitely.",
    example: "2026-02-01T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  pinnedUntil?: Date;
}
