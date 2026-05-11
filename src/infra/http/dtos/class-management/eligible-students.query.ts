import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

import { StandardRequestDto } from "@/core/modules/standard-response/dto/standard-request.dto";
import { StudentStatus } from "@/domain/user-management/enums/student-status.enum";

const ELIGIBLE_STATUS_ALLOW_LIST: StudentStatus[] = [
  StudentStatus.ACTIVE,
  StudentStatus.WAITING,
  StudentStatus.TRIAL,
  StudentStatus.DEFERRED,
];

const parseStatusCsv = (value: unknown): StudentStatus[] | undefined => {
  if (Array.isArray(value)) {
    return value
      .map((part) =>
        typeof part === "string" ? part.trim().toUpperCase() : "",
      )
      .filter((part) => part.length > 0) as StudentStatus[];
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  return trimmed
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0) as StudentStatus[];
};

export class EligibleStudentsQuery extends StandardRequestDto {
  @ApiPropertyOptional({
    description: "Case-insensitive substring match against student fullName",
    example: "Anh",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description:
      "Comma-separated list of student statuses to include. Defaults to ACTIVE " +
      "when omitted. Permitted values: ACTIVE, WAITING, TRIAL, DEFERRED. " +
      "DROPPED and GRADUATED are rejected (D6).",
    example: "ACTIVE,WAITING",
  })
  @IsOptional()
  @Transform(({ value }) => parseStatusCsv(value))
  @IsArray()
  @IsIn(ELIGIBLE_STATUS_ALLOW_LIST, { each: true })
  includeStatuses?: StudentStatus[];
}
