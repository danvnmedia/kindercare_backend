import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import {
  AudienceType,
  PostStatus,
  PostType,
} from "@/domain/content-management/enums";
import { FileResponse } from "../file/file.response";
import { UserResponse } from "../user.response";
export class PostAudienceResponse {
  @ApiProperty({
    description: "The ID of the audience.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "The type of the audience.",
    enum: AudienceType,
    example: AudienceType.CLASS,
  })
  @Expose()
  type: AudienceType;

  @ApiProperty({
    description: "The ID of the post.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  postId: string;

  @ApiProperty({
    description: "The ID of the class.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
    required: false,
  })
  @Expose()
  classId?: string;

  @ApiProperty({
    description: "The ID of the student.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
    required: false,
  })
  @Expose()
  studentId?: string;

  @ApiProperty({
    description: "The ID of the grade.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
    required: false,
  })
  @Expose()
  gradeId?: string;
}

export class AttachmentResponse {
  @ApiProperty({
    description: "The ID of the attachment.",
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
    description: "The ID of the file.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  fileId: string;

  @ApiProperty({
    description: "A comment for the attachment.",
    example: "This is a comment.",
    required: false,
  })
  @Expose()
  comment?: string;

  @ApiProperty({
    description: "The order of the attachment.",
    example: 1,
  })
  @Expose()
  order: number;

  @ApiProperty({
    description: "The file information.",
  })
  @Expose()
  @Type(() => FileResponse)
  file: FileResponse;
}

export class PostResponse {
  @ApiProperty({
    description: "The ID of the post.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

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
    description: "The type of the post.",
    enum: PostType,
    example: PostType.ANNOUNCEMENT,
  })
  @Expose()
  type: PostType;

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
    description: "The author of the post.",
  })
  @Expose()
  @Type(() => UserResponse)
  author: UserResponse;

  @ApiProperty({
    description: "The audiences of the post.",
    type: [PostAudienceResponse],
  })
  @Type(() => PostAudienceResponse)
  @Expose()
  audiences: PostAudienceResponse[];

  @ApiProperty({
    description: "The attachments of the post.",
    type: [AttachmentResponse],
  })
  @Type(() => AttachmentResponse)
  attachments: AttachmentResponse[];

  @ApiProperty({
    description: "The date the post was created.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  createdAt: Date;

  @ApiProperty({
    description: "The date the post was last updated.",
    example: "2021-01-01T00:00:00.000Z",
    required: false,
  })
  @Expose()
  updatedAt?: Date;
}
