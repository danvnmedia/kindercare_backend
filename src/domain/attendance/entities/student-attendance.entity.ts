import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { AttendanceStatus } from "../enums/attendance-status.enum";
import { Class } from "@/domain/class-management/entities/class.entity";
import { Student } from "@/domain/user-management/entities/student.entity";

export interface StudentAttendanceProps {
  studentId: string;
  classId: string;
  campusId: string;
  date: Date;
  checkinAt: Date | null;
  checkoutAt: Date | null;
  status: AttendanceStatus;
  reason: string | null;
  note: string | null;
  // Optional loaded relations
  student?: Student;
  class?: Class;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateStudentAttendanceData = Omit<
  StudentAttendanceProps,
  "createdAt" | "updatedAt" | "student" | "class"
>;

export type UpdateStudentAttendanceData = Partial<
  Pick<
    StudentAttendanceProps,
    "checkinAt" | "checkoutAt" | "status" | "reason" | "note"
  >
>;

export class StudentAttendance extends Entity<StudentAttendanceProps> {
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

  get checkinAt(): Date | null {
    return this.props.checkinAt;
  }

  get checkoutAt(): Date | null {
    return this.props.checkoutAt;
  }

  get status(): AttendanceStatus {
    return this.props.status;
  }

  get reason(): string | null {
    return this.props.reason;
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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Record check-in time
   */
  public checkin(time: Date = new Date()): void {
    this.props.checkinAt = time;
    this.touch();
  }

  /**
   * Record check-out time
   */
  public checkout(time: Date = new Date()): void {
    this.props.checkoutAt = time;
    this.touch();
  }

  /**
   * Update attendance status
   */
  public updateStatus(status: AttendanceStatus, reason?: string): void {
    this.props.status = status;
    if (reason !== undefined) {
      this.props.reason = reason?.trim() || null;
    }
    this.touch();
  }

  /**
   * Update attendance record
   */
  public update(data: UpdateStudentAttendanceData): void {
    if (data.checkinAt !== undefined) {
      this.props.checkinAt = data.checkinAt;
    }
    if (data.checkoutAt !== undefined) {
      this.props.checkoutAt = data.checkoutAt;
    }
    if (data.status !== undefined) {
      this.props.status = data.status;
    }
    if (data.reason !== undefined) {
      this.props.reason = data.reason?.trim() || null;
    }
    if (data.note !== undefined) {
      this.props.note = data.note?.trim() || null;
    }
    this.touch();
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
      StudentAttendanceProps,
      | "createdAt"
      | "updatedAt"
      | "checkinAt"
      | "checkoutAt"
      | "reason"
      | "note"
      | "student"
      | "class"
    >,
    id?: string,
  ): StudentAttendance {
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

    const attendanceProps: StudentAttendanceProps = {
      ...props,
      checkinAt: props.checkinAt ?? null,
      checkoutAt: props.checkoutAt ?? null,
      reason: props.reason?.trim() || null,
      note: props.note?.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new StudentAttendance(
      attendanceProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
