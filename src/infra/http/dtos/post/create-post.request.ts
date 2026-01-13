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
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import { AudienceType } from "@/domain/content-management";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

class CreateAudienceDto {
  @ApiProperty({
    description: "The audience type",
    enum: AudienceType,
    example: "CLASS",
  })
  @IsEnum(AudienceType)
  audienceType: AudienceType;

  @ApiPropertyOptional({
    description:
      "The audience ID (required for CLASS, GRADE, STUDENT types; optional for ALL type where campusId from header is used)",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @ValidateIf((o) => o.audienceType !== AudienceType.ALL)
  @IsUUID()
  audienceId?: string;
}

export class CreatePostRequest {
  @ApiPropertyOptional({
    description:
      "The campus ID where the post will be created (optional - uses X-Campus-Id header if not provided)",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @IsOptional()
  @IsUUID()
  campusId?: string;

  @ApiProperty({
    description: "The title of the post",
    example: "Welcome to our school",
  })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({
    description: "The content of the post in Tiptap/ProseMirror JSON format",
    example: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello World" }],
        },
      ],
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;

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
    type: [CreateAudienceDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAudienceDto)
  audiences: CreateAudienceDto[];
}
