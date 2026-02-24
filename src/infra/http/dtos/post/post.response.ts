import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { AudienceType, PostStatus } from "@/domain/content-management/enums";
import { FileResponse } from "../file/file.response";
import { UserResponse } from "../user.response";

export class PostCategoryReferenceResponse {
  @ApiProperty({
    description: "The ID of the category.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "The name of the category.",
    example: "Announcements",
  })
  @Expose()
  name: string;

  @ApiProperty({
    description: "The hex color code of the category.",
    example: "#FF5733",
  })
  @Expose()
  color: string;

  @ApiPropertyOptional({
    description: "The icon identifier for the category.",
    example: "megaphone",
    nullable: true,
  })
  @Expose()
  icon: string | null;
}

class AudienceClassResponse {
  @ApiProperty({ example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f" })
  @Expose()
  id: string;

  @ApiProperty({ example: "Sunflower" })
  @Expose()
  name: string;
}

class AudienceStudentResponse {
  @ApiProperty({ example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f" })
  @Expose()
  id: string;

  @ApiProperty({ example: "Jane Doe" })
  @Expose()
  fullName: string;
}

class AudienceGradeLevelResponse {
  @ApiProperty({ example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f" })
  @Expose()
  id: string;

  @ApiProperty({ example: "Grade 1" })
  @Expose()
  name: string;
}

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
    description: "The campus ID this audience belongs to.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  campusId: string;

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
    description: "The ID of the grade level.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
    required: false,
  })
  @Expose()
  gradeLevelId?: string;

  @ApiPropertyOptional({
    description: "The class details (when type is CLASS).",
    type: AudienceClassResponse,
  })
  @Expose()
  @Type(() => AudienceClassResponse)
  class?: AudienceClassResponse;

  @ApiPropertyOptional({
    description: "The student details (when type is STUDENT).",
    type: AudienceStudentResponse,
  })
  @Expose()
  @Type(() => AudienceStudentResponse)
  student?: AudienceStudentResponse;

  @ApiPropertyOptional({
    description: "The grade level details (when type is GRADE).",
    type: AudienceGradeLevelResponse,
  })
  @Expose()
  @Type(() => AudienceGradeLevelResponse)
  gradeLevel?: AudienceGradeLevelResponse;
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
    description: "The campus ID of the post.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  campusId: string;

  @ApiProperty({
    description: "The title of the post.",
    example: "This is a post title.",
  })
  @Expose()
  title: string;

  @ApiProperty({
    description: "The content of the post in Tiptap/ProseMirror JSON format.",
    example: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello World" }],
        },
      ],
    },
  })
  @Expose()
  content: Record<string, unknown> | null;

  @ApiProperty({
    description: "Plain text extracted from content for search purposes.",
    example: "Hello World",
    required: false,
  })
  @Expose()
  contentText: string | null;

  @ApiProperty({
    description: "Version number tracking content edits.",
    example: 1,
  })
  @Expose()
  contentVersion: number;

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
    description: "Whether the post is pinned to the top of the feed.",
    example: false,
  })
  @Expose()
  isPinned: boolean;

  @ApiProperty({
    description: "The date until which the post is pinned.",
    example: "2021-01-01T00:00:00.000Z",
    required: false,
  })
  @Expose()
  pinnedUntil?: Date;

  @ApiProperty({
    description: "Whether the post requires approval before publishing.",
    example: true,
  })
  @Expose()
  requiresApproval: boolean;

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
  @Expose()
  attachments: AttachmentResponse[];

  @ApiProperty({
    description: "The categories associated with the post.",
    type: [PostCategoryReferenceResponse],
  })
  @Type(() => PostCategoryReferenceResponse)
  @Expose()
  categories: PostCategoryReferenceResponse[];

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
