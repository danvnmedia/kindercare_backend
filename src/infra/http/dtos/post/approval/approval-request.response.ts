import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { ApprovalStatus } from "@/domain/content-management/enums/approval-status.enum";

/**
 * Simplified user info for approval request responses.
 */
export class UserSummaryResponse {
  @ApiProperty({
    description: "The ID of the user.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiPropertyOptional({
    description: "The user's first name.",
    example: "John",
  })
  @Expose()
  firstName?: string;

  @ApiPropertyOptional({
    description: "The user's last name.",
    example: "Doe",
  })
  @Expose()
  lastName?: string;
}

/**
 * Response DTO for post approval requests.
 */
export class ApprovalRequestResponse {
  @ApiProperty({
    description: "The ID of the approval request.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  id: string;

  @ApiProperty({
    description: "The ID of the post being approved.",
    example: "c6a8a9b4-7f1a-4f5f-8a9a-9b4a7f1a4f5f",
  })
  @Expose()
  postId: string;

  @ApiProperty({
    description: "The status of the approval request.",
    enum: ApprovalStatus,
    example: ApprovalStatus.PENDING,
  })
  @Expose()
  status: ApprovalStatus;

  @ApiProperty({
    description: "The title snapshot at submission time.",
    example: "Weekly Class Update",
  })
  @Expose()
  titleSnapshot: string;

  @ApiPropertyOptional({
    description: "The content snapshot at submission time (JSON format).",
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
  contentSnapshot?: Record<string, unknown>;

  @ApiProperty({
    description: "The user who submitted the approval request.",
  })
  @Expose()
  @Type(() => UserSummaryResponse)
  submittedBy: UserSummaryResponse;

  @ApiProperty({
    description: "The date the approval request was submitted.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  submittedAt: Date;

  @ApiPropertyOptional({
    description: "The user who reviewed the approval request (if reviewed).",
  })
  @Expose()
  @Type(() => UserSummaryResponse)
  reviewedBy?: UserSummaryResponse;

  @ApiPropertyOptional({
    description: "The date the approval request was reviewed (if reviewed).",
    example: "2021-01-02T00:00:00.000Z",
  })
  @Expose()
  reviewedAt?: Date;

  @ApiPropertyOptional({
    description: "The review note (rejection reason or approval comment).",
    example: "Approved for publishing.",
  })
  @Expose()
  reviewNote?: string;

  @ApiProperty({
    description: "The date the approval request was created.",
    example: "2021-01-01T00:00:00.000Z",
  })
  @Expose()
  createdAt: Date;
}
