import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { PostTransitionAction } from "@/domain/content-management/enums/post-transition-action.enum";
import { PostResponse } from "./post.response";

export class BatchTransitionPostRequest {
  @ApiProperty({
    type: [String],
    description: "Post UUIDs to transition. Duplicate IDs are processed once.",
    maxItems: 100,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID("4", { each: true })
  postIds: string[];

  @ApiProperty({
    enum: PostTransitionAction,
    description: "The action to perform on each post",
  })
  @IsEnum(PostTransitionAction)
  action: PostTransitionAction;

  @ApiProperty({
    required: false,
    description: "Comment for the transition, required by rejection flows",
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class BatchTransitionPostErrorResponse {
  @ApiProperty()
  @Expose()
  code: string;

  @ApiProperty()
  @Expose()
  message: string;

  @ApiProperty()
  @Expose()
  statusCode: number;
}

export class BatchTransitionPostResultResponse {
  @ApiProperty()
  @Expose()
  postId: string;

  @ApiProperty()
  @Expose()
  success: boolean;

  @ApiProperty({ type: PostResponse, required: false })
  @Expose()
  @Type(() => PostResponse)
  post?: PostResponse;

  @ApiProperty({ type: BatchTransitionPostErrorResponse, required: false })
  @Expose()
  @Type(() => BatchTransitionPostErrorResponse)
  error?: BatchTransitionPostErrorResponse;
}

export class BatchTransitionPostResponse {
  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  succeeded: number;

  @ApiProperty()
  @Expose()
  failed: number;

  @ApiProperty({ type: [BatchTransitionPostResultResponse] })
  @Expose()
  @Type(() => BatchTransitionPostResultResponse)
  results: BatchTransitionPostResultResponse[];
}
