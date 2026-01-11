/**
 * StudentAttendance Repository Port (Interface)
 * Defines the contract for student attendance data access
 * Implementation will be provided by infrastructure layer
 */

import { StudentAttendance } from "@/domain/attendance/entities/student-attendance.entity";
import { StandardRequest } from "@/core/modules/standard-response/dto/standard-request.dto";
import { PaginatedResult } from "@/core/modules/standard-response/dto/query.dto";

export abstract class StudentAttendanceRepository {
  /**
   * Find attendance record by ID
   */
  abstract findById(id: string): Promise<StudentAttendance | null>;

  /**
   * Find attendance by student and date (unique constraint)
   */
  abstract findByStudentAndDate(
    studentId: string,
    date: Date,
  ): Promise<StudentAttendance | null>;

  /**
   * Find all attendance records for a class on a specific date
   */
  abstract findByClassAndDate(
    classId: string,
    date: Date,
  ): Promise<StudentAttendance[]>;

  /**
   * Find attendance records for a student within a date range
   */
  abstract findByStudentDateRange(
    studentId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<StudentAttendance[]>;

  /**
   * Find all attendance records for a campus with filtering, sorting, pagination
   */
  abstract findByCampus(
    campusId: string,
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendance>>;

  /**
   * Find all attendance records with filtering, sorting, pagination
   */
  abstract findAll(
    params: StandardRequest,
  ): Promise<PaginatedResult<StudentAttendance>>;

  /**
   * Save a new attendance record
   */
  abstract save(attendance: StudentAttendance): Promise<StudentAttendance>;

  /**
   * Save multiple attendance records
   */
  abstract saveMany(
    attendances: StudentAttendance[],
  ): Promise<StudentAttendance[]>;

  /**
   * Update existing attendance record
   */
  abstract update(attendance: StudentAttendance): Promise<StudentAttendance>;

  /**
   * Delete attendance record
   */
  abstract delete(id: string): Promise<void>;

  /**
   * Delete all attendance records for a student
   */
  abstract deleteByStudentId(studentId: string): Promise<void>;
}
