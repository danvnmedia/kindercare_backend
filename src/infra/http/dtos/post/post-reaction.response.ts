import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class PostReactionResponse {
  @ApiProperty({
    description: "Whether the current user has reacted to this post.",
    example: true,
  })
  @Expose()
  hasReacted: boolean;

  @ApiProperty({
    description: "Total number of reactions on the post.",
    example: 42,
  })
  @Expose()
  reactionCount: number;
}
