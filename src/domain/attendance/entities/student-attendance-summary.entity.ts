import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { AttendanceStatus } from "../enums/attendance-status.enum";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { StudentAttendanceLog } from "./student-attendance-log.entity";

export interface StudentAttendanceSummaryProps {
  studentId: string;
  classId: string;
  campusId: string;
  date: Date;
  status: AttendanceStatus;
  // Cached fields from logs
  firstCheckinAt: Date | null;
  lastCheckoutAt: Date | null;
  totalMinutesPresent: number;
  // Audit
  updatedById: string | null;
  note: string | null;
  // Optional loaded relations
  student?: Student;
  class?: Class;
  logs?: StudentAttendanceLog[];
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStudentAttendanceSummaryData = Omit<
  StudentAttendanceSummaryProps,
  "createdAt" | "updatedAt" | "student" | "class" | "logs"
>;

export type UpdateStudentAttendanceSummaryData = Partial<
  Pick<
    StudentAttendanceSummaryProps,
    | "firstCheckinAt"
    | "lastCheckoutAt"
    | "totalMinutesPresent"
    | "status"
    | "updatedById"
    | "note"
  >
>;

export class StudentAttendanceSummary extends Entity<StudentAttendanceSummaryProps> {
  // --- Getters ---
  get studentId(): string {
    return this.props.studentId;
  }

  get classId(): string {
    return this.props.classId;
  }

  get campusId(): string {
    return this.props.campusId;
  }

  get date(): Date {
    return this.props.date;
  }

  get status(): AttendanceStatus {
    return this.props.status;
  }

  get firstCheckinAt(): Date | null {
    return this.props.firstCheckinAt;
  }

  get lastCheckoutAt(): Date | null {
    return this.props.lastCheckoutAt;
  }

  get totalMinutesPresent(): number {
    return this.props.totalMinutesPresent;
  }

  get updatedById(): string | null {
    return this.props.updatedById;
  }

  get note(): string | null {
    return this.props.note;
  }

  get student(): Student | undefined {
    return this.props.student;
  }

  get class(): Class | undefined {
    return this.props.class;
  }

  get logs(): StudentAttendanceLog[] | undefined {
    return this.props.logs;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Update cached check-in time (from logs)
   */
  public setFirstCheckinAt(time: Date | null): void {
    this.props.firstCheckinAt = time;
    this.touch();
  }

  /**
   * Update cached check-out time (from logs)
   */
  public setLastCheckoutAt(time: Date | null): void {
    this.props.lastCheckoutAt = time;
    this.touch();
  }

  /**
   * Update total minutes present
   */
  public setTotalMinutesPresent(minutes: number): void {
    this.props.totalMinutesPresent = minutes;
    this.touch();
  }

  /**
   * Update attendance status
   */
  public updateStatus(status: AttendanceStatus, updatedById?: string): void {
    this.props.status = status;
    if (updatedById !== undefined) {
      this.props.updatedById = updatedById;
    }
    this.touch();
  }

  /**
   * Update attendance record
   */
  public update(data: UpdateStudentAttendanceSummaryData): void {
    if (data.firstCheckinAt !== undefined) {
      this.props.firstCheckinAt = data.firstCheckinAt;
    }
    if (data.lastCheckoutAt !== undefined) {
      this.props.lastCheckoutAt = data.lastCheckoutAt;
    }
    if (data.totalMinutesPresent !== undefined) {
      this.props.totalMinutesPresent = data.totalMinutesPresent;
    }
    if (data.status !== undefined) {
      this.props.status = data.status;
    }
    if (data.updatedById !== undefined) {
      this.props.updatedById = data.updatedById;
    }
    if (data.note !== undefined) {
      this.props.note = data.note?.trim() || null;
    }
    this.touch();
  }

  /**
   * Recalculate cached times from logs
   */
  public recalculateCachedTimes(logs: StudentAttendanceLog[]): void {
    const checkins = logs
      .filter((log) => log.type === "CHECK_IN")
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const checkouts = logs
      .filter((log) => log.type === "CHECK_OUT")
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    this.props.firstCheckinAt = checkins.length > 0 ? checkins[0].timestamp : null;
    this.props.lastCheckoutAt = checkouts.length > 0 ? checkouts[0].timestamp : null;

    // Calculate total minutes present
    this.props.totalMinutesPresent = this.calculateTotalMinutes(logs);
    this.touch();
  }

  /**
   * Calculate total minutes present from logs
   */
  private calculateTotalMinutes(logs: StudentAttendanceLog[]): number {
    const sortedLogs = [...logs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    let totalMinutes = 0;
    let lastCheckinTime: Date | null = null;

    for (const log of sortedLogs) {
      if (log.type === "CHECK_IN") {
        lastCheckinTime = log.timestamp;
      } else if (log.type === "CHECK_OUT" && lastCheckinTime) {
        const minutes = Math.floor(
          (log.timestamp.getTime() - lastCheckinTime.getTime()) / (1000 * 60),
        );
        totalMinutes += minutes;
        lastCheckinTime = null;
      }
    }

    return totalMinutes;
  }

  /**
   * Returns a unique composite key for this attendance record
   */
  public getCompositeKey(): string {
    const dateStr = this.props.date.toISOString().split("T")[0];
    return `${this.props.studentId}-${dateStr}`;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      StudentAttendanceSummaryProps,
      | "createdAt"
      | "updatedAt"
      | "firstCheckinAt"
      | "lastCheckoutAt"
      | "totalMinutesPresent"
      | "updatedById"
      | "note"
      | "student"
      | "class"
      | "logs"
    >,
    id?: string,
  ): StudentAttendanceSummary {
    // Validation
    if (!props.studentId) {
      throw new Error("Student ID is required");
    }
    if (!props.classId) {
      throw new Error("Class ID is required");
    }
    if (!props.campusId) {
      throw new Error("Campus ID is required");
    }
    if (!props.date) {
      throw new Error("Date is required");
    }
    if (!props.status) {
      throw new Error("Status is required");
    }

    const summaryProps: StudentAttendanceSummaryProps = {
      ...props,
      firstCheckinAt: props.firstCheckinAt ?? null,
      lastCheckoutAt: props.lastCheckoutAt ?? null,
      totalMinutesPresent: props.totalMinutesPresent ?? 0,
      updatedById: props.updatedById ?? null,
      note: props.note?.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new StudentAttendanceSummary(
      summaryProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
