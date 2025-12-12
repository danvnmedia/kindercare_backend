import { ApiProperty } from "@nestjs/swagger";
import { PostStatus } from "@/domain/content-management/enums/post-status.enum";
import { PostType } from "@/domain/content-management/enums/post-type.enum";
import { Expose, Transform } from "class-transformer";

export class PostHistoryResponse {
  @ApiProperty({
    description: "The ID of the post history.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "The ID of the post.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  postId: string;

  @ApiProperty({
    description: "The ID of the author.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  authorId: string;

  @ApiProperty({
    description: "The type of the post.",
    enum: PostType,
    example: PostType.ANNOUNCEMENT,
  })
  @Expose()
  type: PostType;

  @ApiProperty({
    description: "The title of the post.",
    example: "This is a post title.",
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: "The content of the post.",
    example: "This is the post content.",
  })
  @Expose()
  content: string;

  @ApiProperty({
    description: "The status of the post.",
    enum: PostStatus,
    example: PostStatus.DRAFT,
  })
  @Expose()
  status: PostStatus;

  @ApiProperty({
    description: "The date the post was published.",
    example: "2021-01-01T00:00:00.000Z",
    required: false,
  })
  @Expose()
  publishAt?: Date;

  @ApiProperty({
    description: "The date the post history was created.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  createdAt: Date;
}

export class PostHistoryStatusResponse {
  @ApiProperty({
    description: "The ID of the post history status.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  @Transform(({ value }) => value.toString())
  id: string;

  @ApiProperty({
    description: "The ID of the post.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  @Transform(({ value }) => value.toString())
  postId: string;

  @ApiProperty({
    description: "The ID of the user.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  @Transform(({ value }) => value.toString())
  userId: string;

  @ApiProperty({
    description: "The status of the post.",
    enum: PostStatus,
    example: PostStatus.DRAFT,
  })
  @Expose()
  status: PostStatus;

  @ApiProperty({
    description: "A comment for the status.",
    example: "This is a comment.",
    required: false,
  })
  @Expose()
  comment?: string | null;

  @ApiProperty({
    description: "The date the status was created.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  createdAt: Date;
}
