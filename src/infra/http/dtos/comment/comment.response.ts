import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { UserResponse } from "../user.response";

/**
 * Response DTO for a comment with nested replies
 */
export class CommentResponse {
  @ApiProperty({
    description: "The ID of the comment",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "The ID of the post this comment belongs to",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  postId: string;

  @ApiProperty({
    description: "The ID of the user who created the comment",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  userId: string;

  @ApiPropertyOptional({
    description: "The user who created the comment",
  })
  @Expose()
  @Type(() => UserResponse)
  user?: UserResponse;

  @ApiProperty({
    description: "The ID of the parent comment (null for root comments)",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
    nullable: true,
  })
  @Expose()
  parentCommentId: string | null;

  @ApiProperty({
    description:
      "The nesting depth of the comment (0 = root, 1 = reply, 2 = reply-to-reply)",
    example: 0,
  })
  @Expose()
  depth: number;

  @ApiProperty({
    description:
      "The content of the comment. Shows placeholder text if comment is deleted.",
    example: "This is a great post!",
  })
  @Expose()
  content: string;

  @ApiProperty({
    description: "Whether the comment has been deleted",
    example: false,
  })
  @Expose()
  isDeleted: boolean;

  @ApiProperty({
    description: "The date the comment was created",
    example: "2026-01-01T00:00:00.000Z",
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: "The date the comment was last updated",
    example: "2026-01-01T00:00:00.000Z",
  })
  @Expose()
  updatedAt: Date;

  @ApiProperty({
    description: "Nested replies to this comment",
    type: () => [CommentWithRepliesResponse],
  })
  @Expose()
  @Type(() => CommentWithRepliesResponse)
  replies: CommentWithRepliesResponse[];

  @ApiProperty({
    description: "Total count of all nested replies",
    example: 5,
  })
  @Expose()
  replyCount: number;
}

/**
 * Response DTO for a comment tree node with nested replies
 */
export class CommentWithRepliesResponse {
  @ApiProperty({
    description: "The comment data",
    type: () => CommentResponse,
  })
  @Expose()
  @Type(() => CommentResponse)
  comment: CommentResponse;

  @ApiProperty({
    description: "Nested replies to this comment",
    type: () => [CommentWithRepliesResponse],
  })
  @Expose()
  @Type(() => CommentWithRepliesResponse)
  replies: CommentWithRepliesResponse[];

  @ApiProperty({
    description: "Total count of all nested replies",
    example: 3,
  })
  @Expose()
  replyCount: number;
}

/**
 * Response DTO for the get comments endpoint
 */
export class GetCommentsResponse {
  @ApiProperty({
    description: "List of root comments with nested replies",
    type: [CommentWithRepliesResponse],
  })
  @Expose()
  @Type(() => CommentWithRepliesResponse)
  comments: CommentWithRepliesResponse[];

  @ApiProperty({
    description: "Total count of all comments (including deleted)",
    example: 25,
  })
  @Expose()
  totalCount: number;

  @ApiProperty({
    description: "Count of active (non-deleted) comments",
    example: 23,
  })
  @Expose()
  activeCount: number;
}
