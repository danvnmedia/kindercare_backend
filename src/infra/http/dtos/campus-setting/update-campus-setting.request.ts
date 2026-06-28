import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class UpdateCampusSettingRequest {
  @ApiPropertyOptional({
    description:
      "Whether teacher posts require admin approval before publishing",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requireTeacherApproval?: boolean;

  @ApiPropertyOptional({
    description:
      "Maximum number of posts that can be pinned at the same time (0-10)",
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(0, { message: "Maximum pinned posts cannot be negative" })
  @Max(10, { message: "Maximum pinned posts cannot exceed 10" })
  maxPinnedPosts?: number;

  @ApiPropertyOptional({
    description: "Whether parents can comment on posts",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allowParentComments?: boolean;

  @ApiPropertyOptional({
    description: "Whether reactions are enabled on posts",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allowReactions?: boolean;
}
