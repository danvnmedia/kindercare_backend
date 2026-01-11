import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

export class CampusSettingResponse {
  @Expose()
  @ApiProperty({
    description: "Campus Setting ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: "Campus ID this setting belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  campusId: string;

  @Expose()
  @ApiProperty({
    description:
      "Whether teacher posts require admin approval before publishing",
    example: true,
  })
  requireTeacherApproval: boolean;

  @Expose()
  @ApiProperty({
    description: "Maximum number of posts that can be pinned at the same time",
    example: 3,
    minimum: 0,
    maximum: 10,
  })
  maxPinnedPosts: number;

  @Expose()
  @ApiProperty({
    description: "Whether parents can comment on posts",
    example: true,
  })
  allowParentComments: boolean;

  @Expose()
  @ApiProperty({
    description: "Whether reactions are enabled on posts",
    example: true,
  })
  allowReactions: boolean;

  @Expose()
  @ApiProperty({
    description: "Creation timestamp",
    example: "2024-01-01T00:00:00.000Z",
  })
  createdAt: Date;

  @Expose()
  @ApiProperty({
    description: "Last update timestamp",
    example: "2024-01-01T00:00:00.000Z",
  })
  updatedAt: Date;
}
