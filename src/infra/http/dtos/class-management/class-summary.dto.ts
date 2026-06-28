import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

/**
 * Minimal `{ id, name }` projection of a Class row, used as a nested
 * snapshot on read responses that expose the class a student is currently
 * enrolled in without including the full Class record. Mirrors the
 * `StaffTypeSummaryDto` shape — see snapshot pattern in memory `do29po`.
 */
export class ClassSummaryDto {
  @Expose()
  @ApiProperty({
    description: "Class ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Class display name",
    example: "Lớp Mầm 1A",
  })
  name: string;
}
