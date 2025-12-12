import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { PostTransitionAction } from "@/domain/content-management/enums/post-transition-action.enum";

export class TransitionPostRequest {
  @ApiProperty({
    enum: PostTransitionAction,
    description: "The action to perform on the post",
  })
  @IsEnum(PostTransitionAction)
  action: PostTransitionAction;

  @ApiProperty({
    required: false,
    description: "Comment for the transition (e.g., rejection reason)",
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
