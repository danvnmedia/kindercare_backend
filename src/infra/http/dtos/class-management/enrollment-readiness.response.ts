import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import {
  EnrollmentReadinessMode,
  EnrollmentReadinessState,
} from "@/application/class-management/enrollment-readiness.types";
import { ExitReason } from "@/domain/class-management/enums/exit-reason.enum";

export class EnrollmentReadinessClassContextResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lop A1" })
  name: string;
}

export class EnrollmentReadinessGradeContextResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Grade 1" })
  name: string;

  @Expose()
  @ApiPropertyOptional({ example: 1 })
  order?: number;
}

export class EnrollmentReadinessSchoolYearContextResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "2026-2027" })
  name: string;

  @Expose()
  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  startDate: Date;

  @Expose()
  @ApiProperty({ example: "2027-06-30T00:00:00.000Z" })
  endDate: Date;
}

export class EnrollmentReadinessParentContextResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  gradeLevelId: string;

  @Expose()
  @Type(() => EnrollmentReadinessGradeContextResponse)
  @ApiProperty({
    type: EnrollmentReadinessGradeContextResponse,
    nullable: true,
  })
  gradeLevel: EnrollmentReadinessGradeContextResponse | null;

  @Expose()
  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  enrollmentDate: Date;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  exitDate: Date | null;

  @Expose()
  @ApiProperty({ enum: ExitReason, nullable: true })
  exitReason: ExitReason | null;
}

export class EnrollmentReadinessEnrollmentContextResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174004" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  classId: string;

  @Expose()
  @Type(() => EnrollmentReadinessClassContextResponse)
  @ApiProperty({
    type: EnrollmentReadinessClassContextResponse,
    nullable: true,
  })
  class: EnrollmentReadinessClassContextResponse | null;

  @Expose()
  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  enrollmentDate: Date;

  @Expose()
  @ApiProperty({ example: null, nullable: true })
  endDate: Date | null;

  @Expose()
  @ApiProperty({ enum: ExitReason, nullable: true })
  exitReason: ExitReason | null;
}

export class EnrollmentReadinessContextResponse {
  @Expose()
  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  requestedDate: Date;

  @Expose()
  @Type(() => EnrollmentReadinessClassContextResponse)
  @ApiProperty({ type: EnrollmentReadinessClassContextResponse })
  targetClass: EnrollmentReadinessClassContextResponse;

  @Expose()
  @Type(() => EnrollmentReadinessGradeContextResponse)
  @ApiProperty({
    type: EnrollmentReadinessGradeContextResponse,
    nullable: true,
  })
  targetGradeLevel: EnrollmentReadinessGradeContextResponse | null;

  @Expose()
  @Type(() => EnrollmentReadinessSchoolYearContextResponse)
  @ApiProperty({
    type: EnrollmentReadinessSchoolYearContextResponse,
    nullable: true,
  })
  targetSchoolYear: EnrollmentReadinessSchoolYearContextResponse | null;

  @Expose()
  @Type(() => EnrollmentReadinessParentContextResponse)
  @ApiPropertyOptional({
    type: EnrollmentReadinessParentContextResponse,
    nullable: true,
  })
  schoolYearEnrollment?: EnrollmentReadinessParentContextResponse | null;

  @Expose()
  @Type(() => EnrollmentReadinessEnrollmentContextResponse)
  @ApiPropertyOptional({
    type: EnrollmentReadinessEnrollmentContextResponse,
    nullable: true,
  })
  activeEnrollment?: EnrollmentReadinessEnrollmentContextResponse | null;
}

export class EnrollmentReadinessRowResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174005" })
  studentId: string;

  @Expose()
  @ApiProperty({ enum: EnrollmentReadinessState })
  state: EnrollmentReadinessState;

  @Expose()
  @ApiPropertyOptional({
    description: "Stable machine reason when state is BLOCKED.",
    example: "GRADE_LEVEL_MISMATCH",
  })
  reason?: string;

  @Expose()
  @ApiPropertyOptional({
    description: "Optional detail message for invalid transfer date cases.",
  })
  message?: string;

  @Expose()
  @Type(() => EnrollmentReadinessContextResponse)
  @ApiProperty({ type: EnrollmentReadinessContextResponse })
  context: EnrollmentReadinessContextResponse;
}

export class EnrollmentReadinessResponse {
  @Expose()
  @ApiProperty({ enum: EnrollmentReadinessMode })
  mode: EnrollmentReadinessMode;

  @Expose()
  @ApiProperty({ example: "2026-09-01T00:00:00.000Z" })
  effectiveDate: Date;

  @Expose()
  @Type(() => EnrollmentReadinessRowResponse)
  @ApiProperty({ type: [EnrollmentReadinessRowResponse] })
  rows: EnrollmentReadinessRowResponse[];
}
