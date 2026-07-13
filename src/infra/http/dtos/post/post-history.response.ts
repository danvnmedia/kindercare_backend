import { ApiProperty } from "@nestjs/swagger";
import { PostStatus } from "@/domain/content-management/enums/post-status.enum";
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
  id: string;

  @ApiProperty({
    description: "The ID of the post.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  postId: string;

  @ApiProperty({
    description: "The ID of the user who changed the status.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  changedById: string;

  @ApiProperty({
    description: "The status before the transition.",
    enum: PostStatus,
    example: PostStatus.DRAFT,
    nullable: true,
  })
  @Expose()
  previousStatus: PostStatus | null;

  @ApiProperty({
    description: "The status after the transition.",
    enum: PostStatus,
    example: PostStatus.PUBLISHED,
  })
  @Expose()
  newStatus: PostStatus;

  @ApiProperty({
    description: "The reason for the status transition.",
    example: "Approved for publication.",
    nullable: true,
  })
  @Expose()
  reason: string | null;

  @ApiProperty({
    description: "The date the status changed.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  @Transform(
    ({ obj }: { obj: { changedAt?: Date; createdAt?: Date } }) =>
      obj.changedAt ?? obj.createdAt,
    { toClassOnly: true },
  )
  changedAt: Date;
}
