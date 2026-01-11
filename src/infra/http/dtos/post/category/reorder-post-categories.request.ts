import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsNotEmpty, IsUUID } from "class-validator";

export class ReorderPostCategoriesRequest {
  @ApiProperty({
    description: "Campus ID to scope the reorder operation",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsNotEmpty()
  campusId: string;

  @ApiProperty({
    description:
      "Array of category IDs in the desired order. The order field will be set based on the array index (index 0 = order 1, index 1 = order 2, etc.)",
    example: [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
      "123e4567-e89b-12d3-a456-426614174003",
    ],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  ids: string[];
}
