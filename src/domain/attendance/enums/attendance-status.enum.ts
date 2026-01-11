/**
 * AttendanceStatus enum
 * Defines the possible attendance statuses for students
 */
export enum AttendanceStatus {
  /** Student is present in class */
  PRESENT = "PRESENT",
  /** Student is absent from class */
  ABSENT = "ABSENT",
  /** Student arrived late */
  LATE = "LATE",
  /** Student is excused (with reason) */
  EXCUSED = "EXCUSED",
}
