import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import { ClassStaffPreview } from "./class-staff.response";

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
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  campusId: string;

  @Expose()
  @ApiProperty({ example: "Lớp Mầm" })
  name: string;

  @Expose()
  @ApiProperty({ example: 1 })
  order: number;

  @Expose()
  @ApiProperty({ example: false })
  isArchived: boolean;
}

export class SchoolYearResponse {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174001" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  campusId: string;

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
  campusId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174002" })
  gradeLevelId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174003" })
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

/**
 * One row in the paginated class list. Extends `ClassResponse` with three
 * list-only aggregates the FE needs to render the `/dashboard/classes`
 * student-count column and staff `AvatarGroup`:
 *
 *  - `activeStudentCount` — rows effective on the current UTC date.
 *  - `upcomingStudentCount` — uncancelled rows starting after that date.
 *  - `historicalStudentCount` — uncancelled rows closed before that date.
 *  - `staff` — compact preview of every staff row attached to the class,
 *    ordered HOMEROOM first then by assignment time.
 *
 * Drives `GET /classes`. Per the frontend handoff, neither field is sortable
 * or filterable — both are read-side projections only.
 */
export class ClassListItemResponse extends ClassResponse {
  @Expose()
  @ApiProperty({
    example: 12,
    description:
      "Count of uncancelled enrollments effective on the authoritative current UTC date.",
  })
  activeStudentCount: number;

  @Expose()
  @ApiProperty({
    example: 3,
    description:
      "Count of uncancelled enrollments whose enrollmentDate is after the authoritative current UTC date.",
  })
  upcomingStudentCount: number;

  @Expose()
  @ApiProperty({
    example: 15,
    description:
      "Count of uncancelled enrollment periods closed before the authoritative current UTC date. Inclusive end dates remain active through that date.",
  })
  historicalStudentCount: number;

  @Expose()
  @Type(() => ClassStaffPreview)
  @ApiProperty({
    type: [ClassStaffPreview],
    description:
      "Compact preview of all staff assigned to this class, ordered HOMEROOM first then by assignment createdAt asc.",
  })
  staff: ClassStaffPreview[];
}
