import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CorrectHistoricalRecordRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: "Correcting archived roster label typo" })
  reason: string;

  @IsObject()
  @ApiProperty({
    example: { studentFullName: "Nguyen Van A" },
    description:
      "Allowed fields: studentFullName, studentCode, studentNickname, className, gradeLevelName, gradeLevelOrder, schoolYearName, schoolYearStartDate, schoolYearEndDate.",
  })
  afterValue: Record<string, unknown>;
}

export class HistoricalRetentionActionRequest {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true })
  reason?: string;
}

export class RedactHistoricalRecordRequest {
  @IsString()
  @IsNotEmpty()
  @ApiProperty({ example: "Retention period expired; anonymizing student PII" })
  reason: string;
}
