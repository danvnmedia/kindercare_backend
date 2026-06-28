import { IsString, IsNotEmpty, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { MAX_COMMENT_LENGTH } from "@/domain/content-management/entities/post-comment.entity";

export class CreateCommentRequest {
  @ApiProperty({
    description: "The content of the comment",
    example: "This is a great post! Thank you for sharing.",
    maxLength: MAX_COMMENT_LENGTH,
  })
  @IsString()
  @IsNotEmpty({ message: "Comment content cannot be empty" })
  @MaxLength(MAX_COMMENT_LENGTH, {
    message: `Comment content cannot exceed ${MAX_COMMENT_LENGTH} characters`,
  })
  content: string;
}
