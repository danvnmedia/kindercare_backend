import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Student } from "@/domain/user-management/entities/student.entity";
import { ExitReason } from "../enums/exit-reason.enum";
import { SchoolYearEnrollmentAlreadyClosedException } from "../exceptions/school-year-enrollment-already-closed.exception";
import { InvalidExitDateException } from "../exceptions/invalid-exit-date.exception";
import { GradeLevel } from "./grade-level.entity";
import { SchoolYear } from "./school-year.entity";

export interface SchoolYearEnrollmentProps {
  studentId: string;
  campusId: string;
  schoolYearId: string;
  gradeLevelId: string;
  enrollmentDate: Date;
  exitDate: Date | null;
  exitReason: ExitReason | null;
  note: string | null;
  // Optional loaded relations
  schoolYear?: SchoolYear;
  gradeLevel?: GradeLevel;
  student?: Student;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateSchoolYearEnrollmentData = Omit<
  SchoolYearEnrollmentProps,
  "createdAt" | "updatedAt" | "schoolYear" | "gradeLevel" | "student"
>;
export type UpdateSchoolYearEnrollmentData = Partial<
  Pick<SchoolYearEnrollmentProps, "enrollmentDate" | "note">
>;

export class SchoolYearEnrollment extends Entity<SchoolYearEnrollmentProps> {
  // --- Getters ---
  get studentId(): string {
    return this.props.studentId;
  }

  get campusId(): string {
    return this.props.campusId;
  }

  get schoolYearId(): string {
    return this.props.schoolYearId;
  }

  get gradeLevelId(): string {
    return this.props.gradeLevelId;
  }

  get enrollmentDate(): Date {
    return this.props.enrollmentDate;
  }

  get exitDate(): Date | null {
    return this.props.exitDate;
  }

  get exitReason(): ExitReason | null {
    return this.props.exitReason;
  }

  get note(): string | null {
    return this.props.note;
  }

  get schoolYear(): SchoolYear | undefined {
    return this.props.schoolYear;
  }

  get gradeLevel(): GradeLevel | undefined {
    return this.props.gradeLevel;
  }

  get student(): Student | undefined {
    return this.props.student;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  public isActive(): boolean {
    return this.props.exitDate === null;
  }

  /**
   * Closes the school-year enrollment immutably. Returns a new
   * SchoolYearEnrollment with the same id, leaving the receiver untouched.
   *
   * Throws SchoolYearEnrollmentAlreadyClosedException if the period is already
   * closed. Throws InvalidExitDateException if exitDate is before
   * enrollmentDate or in the future (date-only comparison; time-of-day is
   * ignored). Rejects TRANSFERRED — internal class moves do not close the
   * parent (see specs/school-year-enrollment-model D2).
   */
  public withdraw(exitDate: Date, reason: ExitReason): SchoolYearEnrollment {
    if (!this.isActive()) {
      throw new SchoolYearEnrollmentAlreadyClosedException(this.id);
    }

    SchoolYearEnrollment.assertExitReasonAllowed(reason);

    const exitDay = SchoolYearEnrollment.toDateOnly(exitDate);
    const startDay = SchoolYearEnrollment.toDateOnly(this.props.enrollmentDate);
    const today = SchoolYearEnrollment.toDateOnly(new Date());

    if (exitDay.getTime() < startDay.getTime()) {
      throw new InvalidExitDateException(
        `exitDate (${exitDay.toISOString().slice(0, 10)}) is before enrollmentDate (${startDay.toISOString().slice(0, 10)})`,
      );
    }
    if (exitDay.getTime() > today.getTime()) {
      throw new InvalidExitDateException(
        `exitDate (${exitDay.toISOString().slice(0, 10)}) is in the future`,
      );
    }

    return SchoolYearEnrollment.create(
      {
        studentId: this.props.studentId,
        campusId: this.props.campusId,
        schoolYearId: this.props.schoolYearId,
        gradeLevelId: this.props.gradeLevelId,
        enrollmentDate: this.props.enrollmentDate,
        exitDate: exitDay,
        exitReason: reason,
        note: this.props.note,
        schoolYear: this.props.schoolYear,
        gradeLevel: this.props.gradeLevel,
        student: this.props.student,
        createdAt: this.props.createdAt,
        updatedAt: new Date(),
      },
      this.id,
    );
  }

  public update(data: UpdateSchoolYearEnrollmentData): void {
    if (data.enrollmentDate !== undefined) {
      this.props.enrollmentDate = data.enrollmentDate;
    }
    if (data.note !== undefined) {
      this.props.note = data.note?.trim() || null;
    }
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static toDateOnly(date: Date): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  /**
   * TRANSFERRED is intentionally absent from the parent enrollment lifecycle
   * (see specs/school-year-enrollment-model D2). Class-level moves are handled
   * by TransferStudentUseCase and never close the parent.
   */
  private static assertExitReasonAllowed(reason: ExitReason): void {
    if (reason === ExitReason.TRANSFERRED) {
      throw new Error(
        "TRANSFERRED is not a valid exit reason for SchoolYearEnrollment; " +
          "use a class-level transfer instead",
      );
    }
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      SchoolYearEnrollmentProps,
      | "createdAt"
      | "updatedAt"
      | "note"
      | "exitDate"
      | "exitReason"
      | "schoolYear"
      | "gradeLevel"
      | "student"
    >,
    id?: string,
  ): SchoolYearEnrollment {
    if (!props.studentId) {
      throw new Error("Student ID is required");
    }
    if (!props.campusId) {
      throw new Error("Campus ID is required");
    }
    if (!props.schoolYearId) {
      throw new Error("School year ID is required");
    }
    if (!props.gradeLevelId) {
      throw new Error("Grade level ID is required");
    }
    if (!props.enrollmentDate) {
      throw new Error("Enrollment date is required");
    }

    const exitDate = props.exitDate ?? null;
    const exitReason = props.exitReason ?? null;

    // XOR invariant: exitDate and exitReason must both be set or both be null.
    if ((exitDate === null) !== (exitReason === null)) {
      throw new Error(
        "SchoolYearEnrollment exitDate and exitReason must both be set or both be null",
      );
    }

    if (exitReason !== null) {
      SchoolYearEnrollment.assertExitReasonAllowed(exitReason);
    }

    const enrollmentProps: SchoolYearEnrollmentProps = {
      ...props,
      exitDate,
      exitReason,
      note: props.note?.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new SchoolYearEnrollment(
      enrollmentProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
