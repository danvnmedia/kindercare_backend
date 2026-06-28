import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class PostReactionResponse {
  @ApiProperty({
    description: "Whether the current user has hearted this post.",
    example: true,
  })
  @Expose()
  hearted: boolean;

  @ApiProperty({
    description: "Total number of hearts on the post.",
    example: 42,
  })
  @Expose()
  count: number;
}
