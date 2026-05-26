import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

/**
 * Minimal `{ id, name }` projection of a StaffType row, used as a nested
 * snapshot in read responses that include a staff member's type without
 * exposing the full StaffType record.
 */
export class StaffTypeSummaryDto {
  @Expose()
  @ApiProperty({
    description: "Staff type ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Staff type display name",
    example: "Teacher",
  })
  name: string;
}
