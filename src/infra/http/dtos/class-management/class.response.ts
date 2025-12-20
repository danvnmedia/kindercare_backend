import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class ClassSummaryResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;

  @Expose()
  @ApiProperty({ example: "Lớp Mầm A1 - Năm học 2024-2025", nullable: true })
  description: string | null;
}

export class GradeLevelResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp Mầm" })
  name: string;

  @Expose()
  @ApiProperty({ example: 1 })
  order: number;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;

  @Expose()
  @Type(() => ClassSummaryResponse)
  @ApiPropertyOptional({ type: [ClassSummaryResponse] })
  classes?: ClassSummaryResponse[];
}

export class SchoolYearResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "2024-2025" })
  name: string;

  @Expose()
  @ApiProperty({ example: "2024-09-01T00:00:00.000Z" })
  startDate: Date;

  @Expose()
  @ApiProperty({ example: "2025-06-30T00:00:00.000Z" })
  endDate: Date;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;
}

export class SubjectResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Toán" })
  name: string;
}

export class ClassResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Lớp A1" })
  name: string;

  @Expose()
  @ApiProperty({ example: "Lớp Mầm A1 - Năm học 2024-2025", nullable: true })
  description: string | null;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  gradeLevelId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  schoolYearId: string;

  @Expose()
  @Type(() => GradeLevelResponse)
  @ApiProperty({ type: GradeLevelResponse, required: false })
  gradeLevel?: GradeLevelResponse;

  @Expose()
  @Type(() => SchoolYearResponse)
  @ApiProperty({ type: SchoolYearResponse, required: false })
  schoolYear?: SchoolYearResponse;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: "2025-01-01T00:00:00.000Z" })
  updatedAt: Date;
}
