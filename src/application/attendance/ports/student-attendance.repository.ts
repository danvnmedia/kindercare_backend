/**
 * StudentAttendance Repository Port (Interface)
 * Defines the contract for student attendance data access
 * Implementation will be provided by infrastructure layer
 */

import { StudentAttendanceSummary } from "@/domain/attendance/entities/student-attendance-summary.entity";
import { StudentAttendanceLog } from "@/domain/attendance/entities/student-attendance-log.entity";
import { StudentAttendanceChangeLog } from "@/domain/attendance/entities/student-attendance-change-log.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StudentAttendanceRepository {
  // ==========================================
  // Summary Methods
  // ==========================================

  /**
   * Find attendance summary by ID
   */
  abstract findById(id: string): Promise<StudentAttendanceSummary | null>;

  /**
   * Find attendance summary by student and date (unique constraint)
   */
  abstract findByStudentAndDate(
    studentId: string,
    date: Date,
  ): Promise<StudentAttendanceSummary | null>;

  /**
   * Find all attendance summaries for a class on a specific date
   */
  abstract findByClassAndDate(
    classId: string,
    date: Date,
  ): Promise<StudentAttendanceSummary[]>;

  /**
   * Find attendance summaries for a student within a date range
   */
  abstract findByStudentDateRange(
    studentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StudentAttendanceSummary[]>;

  /**
   * Find all attendance summaries for a campus with filtering, sorting, pagination
   */
  abstract findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendanceSummary>>;

  /**
   * Find all attendance summaries with filtering, sorting, pagination
   */
  abstract findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendanceSummary>>;

  /**
   * Save a new attendance summary
   */
  abstract save(
    summary: StudentAttendanceSummary,
  ): Promise<StudentAttendanceSummary>;

  /**
   * Save multiple attendance summaries
   */
  abstract saveMany(
    summaries: StudentAttendanceSummary[],
  ): Promise<StudentAttendanceSummary[]>;

  /**
   * Update existing attendance summary
   */
  abstract update(
    summary: StudentAttendanceSummary,
  ): Promise<StudentAttendanceSummary>;

  /**
   * Delete attendance summary (and its logs due to cascade)
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Delete all attendance summaries for a student
   */
  abstract deleteByStudentId(studentId: string): Promise<void>;

  // ==========================================
  // Log Methods
  // ==========================================

  /**
   * Find all logs for a summary
   */
  abstract findLogsBySummaryId(
    summaryId: string,
  ): Promise<StudentAttendanceLog[]>;

  /**
   * Save a new attendance log
   */
  abstract saveLog(log: StudentAttendanceLog): Promise<StudentAttendanceLog>;

  /**
   * Save multiple attendance logs
   */
  abstract saveLogs(
    logs: StudentAttendanceLog[],
  ): Promise<StudentAttendanceLog[]>;

  /**
   * Delete all logs for a summary
   */
  abstract deleteLogsBySummaryId(summaryId: string): Promise<void>;

  // ==========================================
  // Change Log Methods
  // ==========================================

  /**
   * Find status/note/absence change timeline entries for a summary.
   */
  abstract findChangeLogsBySummaryId(
    summaryId: string,
  ): Promise<StudentAttendanceChangeLog[]>;

  /**
   * Find status/note/absence change timeline entries for multiple summaries.
   */
  abstract findChangeLogsBySummaryIds(
    summaryIds: string[],
  ): Promise<StudentAttendanceChangeLog[]>;

  /**
   * Save one status/note/absence timeline entry.
   */
  abstract saveChangeLog(
    changeLog: StudentAttendanceChangeLog,
  ): Promise<StudentAttendanceChangeLog>;

  /**
   * Save multiple status/note/absence timeline entries.
   */
  abstract saveChangeLogs(
    changeLogs: StudentAttendanceChangeLog[],
  ): Promise<StudentAttendanceChangeLog[]>;

  // ==========================================
  // Combined Operations (Transaction)
  // ==========================================

  /**
   * Save summary with initial log (atomic operation)
   */
  abstract saveSummaryWithLog(
    summary: StudentAttendanceSummary,
    log: StudentAttendanceLog,
  ): Promise<{ summary: StudentAttendanceSummary; log: StudentAttendanceLog }>;

  /**
   * Save multiple summaries with their logs (atomic operation)
   */
  abstract saveManySummariesWithLogs(
    data: Array<{
      summary: StudentAttendanceSummary;
      log: StudentAttendanceLog;
    }>,
  ): Promise<
    Array<{ summary: StudentAttendanceSummary; log: StudentAttendanceLog }>
  >;
}
