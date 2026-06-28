import { IsString, IsNotEmpty, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { MAX_COMMENT_LENGTH } from "@/domain/content-management/entities/post-comment.entity";

export class UpdateCommentRequest {
  @ApiProperty({
    description: "The updated content of the comment",
    example: "I updated my comment with more information.",
    maxLength: MAX_COMMENT_LENGTH,
  })
  @IsString()
  @IsNotEmpty({ message: "Comment content cannot be empty" })
  @MaxLength(MAX_COMMENT_LENGTH, {
    message: `Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters`,
  })
  content: string;
}
