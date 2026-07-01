import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
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
  code: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  statusCode: number;
}

export class BatchTransitionPostResultResponse {
  @ApiProperty()
  postId: string;

  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: PostResponse, required: false })
  post?: PostResponse;

  @ApiProperty({ type: BatchTransitionPostErrorResponse, required: false })
  error?: BatchTransitionPostErrorResponse;
}

export class BatchTransitionPostResponse {
  @ApiProperty()
  total: number;

  @ApiProperty()
  succeeded: number;

  @ApiProperty()
  failed: number;

  @ApiProperty({ type: [BatchTransitionPostResultResponse] })
  results: BatchTransitionPostResultResponse[];
}
