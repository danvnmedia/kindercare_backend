import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ArrayMinSize, IsUUID } from "class-validator";

export class ReorderStaffTypesRequest {
  @ApiProperty({
    description: "Array of staff type IDs in the desired order",
    example: [
      "550e8400-e29b-41d4-a716-446655440001",
      "550e8400-e29b-41d4-a716-446655440002",
      "550e8400-e29b-41d4-a716-446655440003",
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  ids: string[];
}
