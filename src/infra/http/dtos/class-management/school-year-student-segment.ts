import { SchoolYearStudentSegment } from "@/application/class-management/ports/school-year-enrollment.repository";

export const SchoolYearStudentSegmentEnum = {
  REGISTERED: "registered",
  UPCOMING: "upcoming",
  ACTIVE: "active",
  UNASSIGNED: "unassigned",
  WITHDRAWN: "withdrawn",
  COMPLETED: "completed",
  GRADUATED: "graduated",
  UNRESOLVED: "unresolved",
} as const satisfies Record<string, SchoolYearStudentSegment>;

export const SchoolYearStudentSegmentValues = Object.values(
  SchoolYearStudentSegmentEnum,
);
