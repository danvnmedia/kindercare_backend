import {
  IsEnum,
  IsString,
  MinLength,
  IsOptional,
  IsDate,
  IsArray,
  ValidateNested,
  IsUUID,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { PostStatus, AudienceType } from "@/domain/content-management";
import { ApiProperty } from "@nestjs/swagger";

class UpdateAudienceDto {
  @IsEnum(AudienceType)
  audienceType: AudienceType;

  @IsUUID()
  audienceId: string;
}

export class UpdatePostRequest {
  @ApiProperty({
    description: "The title of the post",
    example: "Updated post title",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiProperty({
    description: "The content of the post in Tiptap/ProseMirror JSON format",
    example: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Updated content" }],
        },
      ],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

  @ApiProperty({
    description: "The status of the post (not allowed for direct update)",
    enum: PostStatus,
    required: false,
    deprecated: true,
  })
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @ApiProperty({
    description: "The date the post should be published",
    example: "2026-01-15T00:00:00.000Z",
    required: false,
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  publishAt?: Date;

  @ApiProperty({
    description: "The audiences for the post",
    type: [UpdateAudienceDto],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateAudienceDto)
  audiences?: UpdateAudienceDto[];
}
