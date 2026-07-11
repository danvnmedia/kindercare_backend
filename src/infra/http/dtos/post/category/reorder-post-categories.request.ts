import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from "class-validator";

export class ReorderPostCategoriesRequest {
  @ApiProperty({
    description:
      "Array of category IDs in the desired order. The order field will be set based on the array index (index 0 = order 1, index 1 = order 2, etc.)",
    example: [
      "123e4567-e89b-12d3-a456-426614174001",
      "123e4567-e89b-12d3-a456-426614174002",
      "123e4567-e89b-12d3-a456-426614174003",
    ],
    type: [String],
    minItems: 1,
    uniqueItems: true,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  ids: string[];
}
