import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Class } from "./class.entity";
import { SchoolYearEnrollment } from "./school-year-enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { ExitReason } from "../enums/exit-reason.enum";
import { EnrollmentAlreadyClosedException } from "../exceptions/enrollment-already-closed.exception";
import { InvalidEndDateException } from "../exceptions/invalid-end-date.exception";

export interface EnrollmentProps {
  classId: string;
  studentId: string;
  schoolYearEnrollmentId: string;
  enrollmentDate: Date;
  endDate: Date | null;
  exitReason: ExitReason | null;
  note: string | null;
  // Optional loaded relations
  class?: Class;
  student?: Student;
  schoolYearEnrollment?: SchoolYearEnrollment;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateEnrollmentData = Omit<
  EnrollmentProps,
  "createdAt" | "updatedAt" | "class" | "student" | "schoolYearEnrollment"
>;
export type UpdateEnrollmentData = Partial<
  Pick<EnrollmentProps, "enrollmentDate" | "note">
>;

export class Enrollment extends Entity<EnrollmentProps> {
  // --- Getters ---
  get classId(): string {
    return this.props.classId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get schoolYearEnrollmentId(): string {
    return this.props.schoolYearEnrollmentId;
  }

  get enrollmentDate(): Date {
    return this.props.enrollmentDate;
  }

  get endDate(): Date | null {
    return this.props.endDate;
  }

  get exitReason(): ExitReason | null {
    return this.props.exitReason;
  }

  get note(): string | null {
    return this.props.note;
  }

  get class(): Class | undefined {
    return this.props.class;
  }

  get student(): Student | undefined {
    return this.props.student;
  }

  get schoolYearEnrollment(): SchoolYearEnrollment | undefined {
    return this.props.schoolYearEnrollment;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  public isActive(): boolean {
    return this.props.endDate === null;
  }

  /**
   * Closes the enrollment period immutably. Returns a new Enrollment instance
   * with the same id, leaving the receiver untouched.
   *
   * Throws EnrollmentAlreadyClosedException if the period is already closed.
   * Throws InvalidEndDateException if endDate is before enrollmentDate or in
   * the future (date-only comparison; time-of-day is ignored).
   */
  public withdraw(endDate: Date, reason: ExitReason): Enrollment {
    if (!this.isActive()) {
      throw new EnrollmentAlreadyClosedException(this.id);
    }

    const endDay = Enrollment.toDateOnly(endDate);
    const startDay = Enrollment.toDateOnly(this.props.enrollmentDate);
    const today = Enrollment.toDateOnly(new Date());

    if (endDay.getTime() < startDay.getTime()) {
      throw new InvalidEndDateException(
        `endDate (${endDay.toISOString().slice(0, 10)}) is before enrollmentDate (${startDay.toISOString().slice(0, 10)})`,
      );
    }
    if (endDay.getTime() > today.getTime()) {
      throw new InvalidEndDateException(
        `endDate (${endDay.toISOString().slice(0, 10)}) is in the future`,
      );
    }

    return Enrollment.create(
      {
        classId: this.props.classId,
        studentId: this.props.studentId,
        schoolYearEnrollmentId: this.props.schoolYearEnrollmentId,
        enrollmentDate: this.props.enrollmentDate,
        endDate: endDay,
        exitReason: reason,
        note: this.props.note,
        class: this.props.class,
        student: this.props.student,
        schoolYearEnrollment: this.props.schoolYearEnrollment,
        createdAt: this.props.createdAt,
        updatedAt: new Date(),
      },
      this.id,
    );
  }

  public update(data: UpdateEnrollmentData): void {
    if (data.enrollmentDate !== undefined) {
      this.props.enrollmentDate = data.enrollmentDate;
    }
    if (data.note !== undefined) {
      this.props.note = data.note?.trim() || null;
    }
    this.touch();
  }

  /**
   * Returns a unique composite key for this enrollment
   */
  public getCompositeKey(): string {
    const dateStr = this.props.enrollmentDate.toISOString().split("T")[0];
    return `${this.props.studentId}-${this.props.classId}-${dateStr}`;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static toDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      EnrollmentProps,
      | "createdAt"
      | "updatedAt"
      | "note"
      | "endDate"
      | "exitReason"
      | "class"
      | "student"
      | "schoolYearEnrollment"
    >,
    id?: string,
  ): Enrollment {
    if (!props.classId) {
      throw new Error("Class ID is required");
    }
    if (!props.studentId) {
      throw new Error("Student ID is required");
    }
    if (!props.schoolYearEnrollmentId) {
      throw new Error("School year enrollment ID is required");
    }
    if (!props.enrollmentDate) {
      throw new Error("Enrollment date is required");
    }

    const endDate = props.endDate ?? null;
    const exitReason = props.exitReason ?? null;

    // XOR invariant: endDate and exitReason must both be set or both be null.
    if ((endDate === null) !== (exitReason === null)) {
      throw new Error(
        "Enrollment endDate and exitReason must both be set or both be null",
      );
    }

    const enrollmentProps: EnrollmentProps = {
      ...props,
      endDate,
      exitReason,
      note: props.note?.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Enrollment(
      enrollmentProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
