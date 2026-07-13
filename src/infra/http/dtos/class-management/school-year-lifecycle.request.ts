import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  MaxLength,
  Max,
  ValidateNested,
} from "class-validator";

import {
  SCHOOL_YEAR_LIFECYCLE_CANDIDATE_SORT_FIELDS,
  SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES,
  SCHOOL_YEAR_LIFECYCLE_OUTCOMES,
  SCHOOL_YEAR_LIFECYCLE_SCOPE_TYPES,
} from "@/application/class-management/school-year-lifecycle";

export class SchoolYearLifecycleRowRequest {
  @ApiProperty({
    description: "Student ID included in the lifecycle preview or commit plan.",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsNotEmpty()
  @IsUUID()
  studentId: string;

  @ApiPropertyOptional({
    enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES,
    description:
      "Optional per-student outcome override. When omitted, targetClassId implies promote/retain and no targetClassId defaults to graduate.",
  })
  @IsOptional()
  @IsIn([...SCHOOL_YEAR_LIFECYCLE_OUTCOMES])
  outcome?: (typeof SCHOOL_YEAR_LIFECYCLE_OUTCOMES)[number];

  @ApiPropertyOptional({
    description:
      "Existing target-year class ID for promoted or retained students. Commit never creates missing classes.",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @ApiPropertyOptional({
    description: "Optional note applied to lifecycle rows created or closed.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SchoolYearLifecyclePreviewRequest {
  @ApiProperty({
    description: "Source school year to close.",
    example: "123e4567-e89b-12d3-a456-426614174010",
  })
  @IsNotEmpty()
  @IsUUID()
  sourceSchoolYearId: string;

  @ApiProperty({
    description: "Target school year for continuing student registrations.",
    example: "123e4567-e89b-12d3-a456-426614174011",
  })
  @IsNotEmpty()
  @IsUUID()
  targetSchoolYearId: string;

  @ApiProperty({
    description: "Date-only closure date for source-year rows.",
    example: "2026-06-30",
  })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sourceClosureDate: string;

  @ApiProperty({
    description: "Date-only enrollment date for target-year rows.",
    example: "2026-09-01",
  })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetEnrollmentDate: string;

  @ApiProperty({
    description:
      "Explicit student outcomes and target class assignments. At least one row is required; use run-scoped grade/class batching for larger migrations.",
    type: [SchoolYearLifecycleRowRequest],
    minItems: 1,
  })
  @IsArray()
  @ArrayMinSize(1, { message: "EXPLICIT_ROWS_REQUIRED" })
  @ArrayMaxSize(500, { message: "BATCH_TOO_LARGE" })
  @ValidateNested({ each: true })
  @Type(() => SchoolYearLifecycleRowRequest)
  rows: SchoolYearLifecycleRowRequest[];
}

export class SchoolYearLifecycleCommitRequest {
  @ApiProperty({
    description: "Preview run ID returned by the preview endpoint.",
    example: "123e4567-e89b-12d3-a456-426614174020",
  })
  @IsNotEmpty()
  @IsUUID()
  previewRunId: string;

  @ApiProperty({
    description: "SHA-256 digest returned by the preview endpoint.",
    example: "2a1f2f6b3b7b7a6b9bb10dff0f4a7a1b361cd13c6e5f95f8b9db08f0a0bb4b0a",
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  digest: string;
}

export class CreateSchoolYearLifecycleRunRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  sourceSchoolYearId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  targetSchoolYearId: string;

  @ApiProperty({ example: "2026-06-30" })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sourceClosureDate: string;

  @ApiProperty({ example: "2026-09-01" })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetEnrollmentDate: string;
}

export class UpdateSchoolYearLifecycleRunSetupRequest {
  @ApiProperty()
  @IsNotEmpty()
  @IsUUID()
  targetSchoolYearId: string;

  @ApiProperty({ example: "2026-06-30" })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  sourceClosureDate: string;

  @ApiProperty({ example: "2026-09-01" })
  @IsNotEmpty()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  targetEnrollmentDate: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class CancelSchoolYearLifecycleRunRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class RefreshSchoolYearLifecycleCandidatesRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class GetSchoolYearLifecycleCandidatesQuery {
  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 50 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 25;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceGradeLevelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceClassId?: string;

  @ApiPropertyOptional({ default: false })
  @Transform(({ value }) => value === true || value === "true")
  @IsOptional()
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({ enum: SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES })
  @IsOptional()
  @IsIn([...SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES])
  status?: (typeof SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES)[number];

  @ApiPropertyOptional({
    enum: SCHOOL_YEAR_LIFECYCLE_CANDIDATE_SORT_FIELDS,
    default: "gradeOrder",
  })
  @IsOptional()
  @IsIn([...SCHOOL_YEAR_LIFECYCLE_CANDIDATE_SORT_FIELDS])
  sortBy: (typeof SCHOOL_YEAR_LIFECYCLE_CANDIDATE_SORT_FIELDS)[number] =
    "gradeOrder";

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "asc" })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder: "asc" | "desc" = "asc";
}

export class SchoolYearLifecycleDecisionRequest {
  @ApiProperty()
  @IsUUID()
  candidateId: string;

  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES })
  @IsIn([...SCHOOL_YEAR_LIFECYCLE_OUTCOMES])
  outcome: (typeof SCHOOL_YEAR_LIFECYCLE_OUTCOMES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SaveSchoolYearLifecycleDecisionsRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({ type: [SchoolYearLifecycleDecisionRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500, { message: "BATCH_TOO_LARGE" })
  @ValidateNested({ each: true })
  @Type(() => SchoolYearLifecycleDecisionRequest)
  decisions: SchoolYearLifecycleDecisionRequest[];
}

export class BulkSaveSchoolYearLifecycleDecisionsRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceGradeLevelId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceClassId?: string;

  @ApiPropertyOptional({ default: false })
  @Transform(({ value }) => value === true || value === "true")
  @IsOptional()
  @IsBoolean()
  unassigned?: boolean;

  @ApiPropertyOptional({ enum: SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES })
  @IsOptional()
  @IsIn([...SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES])
  status?: (typeof SCHOOL_YEAR_LIFECYCLE_CANDIDATE_STATUSES)[number];

  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_OUTCOMES })
  @IsIn([...SCHOOL_YEAR_LIFECYCLE_OUTCOMES])
  outcome: (typeof SCHOOL_YEAR_LIFECYCLE_OUTCOMES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetClassId?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SchoolYearLifecyclePreviewScopeRequest {
  @ApiProperty({ enum: SCHOOL_YEAR_LIFECYCLE_SCOPE_TYPES.slice(1) })
  @IsIn(["GRADE", "CLASSES", "STUDENTS"])
  type: "GRADE" | "CLASSES" | "STUDENTS";

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  gradeLevelId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsUUID(undefined, { each: true })
  classIds?: string[];

  @ApiPropertyOptional({ type: [String], maxItems: 5000 })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5000)
  @IsUUID(undefined, { each: true })
  candidateIds?: string[];

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  batchIndex?: number;
}

export class PreviewSchoolYearLifecycleRunRequest {
  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({ type: SchoolYearLifecyclePreviewScopeRequest })
  @ValidateNested()
  @Type(() => SchoolYearLifecyclePreviewScopeRequest)
  scope: SchoolYearLifecyclePreviewScopeRequest;
}
