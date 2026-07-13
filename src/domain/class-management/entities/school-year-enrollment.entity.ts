import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Student } from "@/domain/user-management/entities/student.entity";
import { ExitReason } from "../enums/exit-reason.enum";
import { SchoolYearEnrollmentAlreadyClosedException } from "../exceptions/school-year-enrollment-already-closed.exception";
import { InvalidExitDateException } from "../exceptions/invalid-exit-date.exception";
import { GradeLevel } from "./grade-level.entity";
import { SchoolYear } from "./school-year.entity";
import {
  EnrollmentCancellationReason,
  isEnrollmentCancellationReason,
} from "../enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "../enums/enrollment-effective-status.enum";
import { deriveEnrollmentEffectiveStatus } from "../enrollment-effective-status";

export interface SchoolYearEnrollmentProps {
  studentId: string;
  campusId: string;
  schoolYearId: string;
  gradeLevelId: string;
  enrollmentDate: Date;
  exitDate: Date | null;
  exitReason: ExitReason | null;
  note: string | null;
  cancelledAt: Date | null;
  cancellationReason: EnrollmentCancellationReason | null;
  cancellationNote: string | null;
  cancelledByUserId: string | null;
  cancelledByFullName: string | null;
  snapshotStudentFullName: string | null;
  snapshotStudentCode: string | null;
  snapshotStudentNickname: string | null;
  snapshotGradeLevelName: string | null;
  snapshotGradeLevelOrder: number | null;
  snapshotSchoolYearName: string | null;
  snapshotSchoolYearStartDate: Date | null;
  snapshotSchoolYearEndDate: Date | null;
  snapshotCapturedAt: Date | null;
  historicalFinalizedAt: Date | null;
  archivedAt: Date | null;
  redactedAt: Date | null;
  retentionExpiresAt: Date | null;
  retentionPolicySource: string | null;
  legalHold: boolean;
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

  get cancelledAt(): Date | null {
    return this.props.cancelledAt;
  }

  get cancellationReason(): EnrollmentCancellationReason | null {
    return this.props.cancellationReason;
  }

  get cancellationNote(): string | null {
    return this.props.cancellationNote;
  }

  get cancelledByUserId(): string | null {
    return this.props.cancelledByUserId;
  }

  get cancelledByFullName(): string | null {
    return this.props.cancelledByFullName;
  }

  get snapshotStudentFullName(): string | null {
    return this.props.snapshotStudentFullName;
  }

  get snapshotStudentCode(): string | null {
    return this.props.snapshotStudentCode;
  }

  get snapshotStudentNickname(): string | null {
    return this.props.snapshotStudentNickname;
  }

  get snapshotGradeLevelName(): string | null {
    return this.props.snapshotGradeLevelName;
  }

  get snapshotGradeLevelOrder(): number | null {
    return this.props.snapshotGradeLevelOrder;
  }

  get snapshotSchoolYearName(): string | null {
    return this.props.snapshotSchoolYearName;
  }

  get snapshotSchoolYearStartDate(): Date | null {
    return this.props.snapshotSchoolYearStartDate;
  }

  get snapshotSchoolYearEndDate(): Date | null {
    return this.props.snapshotSchoolYearEndDate;
  }

  get snapshotCapturedAt(): Date | null {
    return this.props.snapshotCapturedAt;
  }

  get historicalFinalizedAt(): Date | null {
    return this.props.historicalFinalizedAt;
  }

  get archivedAt(): Date | null {
    return this.props.archivedAt;
  }

  get redactedAt(): Date | null {
    return this.props.redactedAt;
  }

  get retentionExpiresAt(): Date | null {
    return this.props.retentionExpiresAt;
  }

  get retentionPolicySource(): string | null {
    return this.props.retentionPolicySource;
  }

  get legalHold(): boolean {
    return this.props.legalHold;
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

  /**
   * @deprecated This reports structural openness, not calendar-effective
   * activity. Use isStructurallyOpen() or isEffectiveOn(referenceDate).
   */
  public isActive(): boolean {
    return this.isStructurallyOpen();
  }

  public isStructurallyOpen(): boolean {
    return this.props.exitDate === null && this.props.cancelledAt === null;
  }

  public getEffectiveStatus(referenceDate: Date): EnrollmentEffectiveStatus {
    return deriveEnrollmentEffectiveStatus({
      enrollmentDate: this.props.enrollmentDate,
      endDate: this.props.exitDate,
      cancelledAt: this.props.cancelledAt,
      referenceDate,
    });
  }

  public isEffectiveOn(referenceDate: Date): boolean {
    return (
      this.getEffectiveStatus(referenceDate) ===
      EnrollmentEffectiveStatus.ACTIVE
    );
  }

  public cancel(input: {
    cancelledAt: Date;
    reason: EnrollmentCancellationReason;
    note?: string | null;
    actorId: string;
    actorFullName?: string | null;
  }): SchoolYearEnrollment {
    if (
      this.getEffectiveStatus(input.cancelledAt) !==
      EnrollmentEffectiveStatus.UPCOMING
    ) {
      throw new Error(
        "Only an upcoming school-year enrollment can be cancelled",
      );
    }

    return SchoolYearEnrollment.create(
      {
        ...this.props,
        cancelledAt: input.cancelledAt,
        cancellationReason: input.reason,
        cancellationNote: input.note?.trim() || null,
        cancelledByUserId: input.actorId,
        cancelledByFullName: input.actorFullName?.trim() || null,
        historicalFinalizedAt: input.cancelledAt,
        updatedAt: input.cancelledAt,
      },
      this.id,
    );
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
    if (!this.isStructurallyOpen()) {
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
        snapshotStudentFullName: this.props.snapshotStudentFullName,
        snapshotStudentCode: this.props.snapshotStudentCode,
        snapshotStudentNickname: this.props.snapshotStudentNickname,
        snapshotGradeLevelName: this.props.snapshotGradeLevelName,
        snapshotGradeLevelOrder: this.props.snapshotGradeLevelOrder,
        snapshotSchoolYearName: this.props.snapshotSchoolYearName,
        snapshotSchoolYearStartDate: this.props.snapshotSchoolYearStartDate,
        snapshotSchoolYearEndDate: this.props.snapshotSchoolYearEndDate,
        snapshotCapturedAt: this.props.snapshotCapturedAt,
        historicalFinalizedAt: exitDay,
        archivedAt: this.props.archivedAt,
        redactedAt: this.props.redactedAt,
        retentionExpiresAt: this.props.retentionExpiresAt,
        retentionPolicySource: this.props.retentionPolicySource,
        legalHold: this.props.legalHold,
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
      | "cancelledAt"
      | "cancellationReason"
      | "cancellationNote"
      | "cancelledByUserId"
      | "cancelledByFullName"
      | "snapshotStudentFullName"
      | "snapshotStudentCode"
      | "snapshotStudentNickname"
      | "snapshotGradeLevelName"
      | "snapshotGradeLevelOrder"
      | "snapshotSchoolYearName"
      | "snapshotSchoolYearStartDate"
      | "snapshotSchoolYearEndDate"
      | "snapshotCapturedAt"
      | "historicalFinalizedAt"
      | "archivedAt"
      | "redactedAt"
      | "retentionExpiresAt"
      | "retentionPolicySource"
      | "legalHold"
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
    const cancelledAt = props.cancelledAt ?? null;
    const cancellationReason = props.cancellationReason ?? null;
    const cancellationNote = props.cancellationNote?.trim() || null;
    const cancelledByUserId = props.cancelledByUserId?.trim() || null;
    const cancelledByFullName = props.cancelledByFullName?.trim() || null;

    // XOR invariant: exitDate and exitReason must both be set or both be null.
    if ((exitDate === null) !== (exitReason === null)) {
      throw new Error(
        "SchoolYearEnrollment exitDate and exitReason must both be set or both be null",
      );
    }

    if (exitReason !== null) {
      SchoolYearEnrollment.assertExitReasonAllowed(exitReason);
    }

    const hasCancellationDetails =
      cancellationReason !== null ||
      cancellationNote !== null ||
      cancelledByUserId !== null ||
      cancelledByFullName !== null;

    if (cancelledAt === null && hasCancellationDetails) {
      throw new Error(
        "SchoolYearEnrollment cancellation details require cancelledAt",
      );
    }
    if (
      cancellationReason !== null &&
      !isEnrollmentCancellationReason(cancellationReason)
    ) {
      throw new Error("SchoolYearEnrollment cancellationReason is invalid");
    }
    if (
      cancelledAt !== null &&
      (cancellationReason === null || cancelledByUserId === null)
    ) {
      throw new Error(
        "Cancelled SchoolYearEnrollment requires cancellationReason and cancelledByUserId",
      );
    }
    if (cancellationNote !== null && cancellationNote.length > 500) {
      throw new Error(
        "SchoolYearEnrollment cancellationNote must be at most 500 characters",
      );
    }

    const enrollmentProps: SchoolYearEnrollmentProps = {
      ...props,
      exitDate,
      exitReason,
      note: props.note?.trim() || null,
      cancelledAt,
      cancellationReason,
      cancellationNote,
      cancelledByUserId,
      cancelledByFullName,
      snapshotStudentFullName: props.snapshotStudentFullName ?? null,
      snapshotStudentCode: props.snapshotStudentCode ?? null,
      snapshotStudentNickname: props.snapshotStudentNickname ?? null,
      snapshotGradeLevelName: props.snapshotGradeLevelName ?? null,
      snapshotGradeLevelOrder: props.snapshotGradeLevelOrder ?? null,
      snapshotSchoolYearName: props.snapshotSchoolYearName ?? null,
      snapshotSchoolYearStartDate: props.snapshotSchoolYearStartDate ?? null,
      snapshotSchoolYearEndDate: props.snapshotSchoolYearEndDate ?? null,
      snapshotCapturedAt: props.snapshotCapturedAt ?? null,
      historicalFinalizedAt: props.historicalFinalizedAt ?? null,
      archivedAt: props.archivedAt ?? null,
      redactedAt: props.redactedAt ?? null,
      retentionExpiresAt: props.retentionExpiresAt ?? null,
      retentionPolicySource: props.retentionPolicySource ?? null,
      legalHold: props.legalHold ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new SchoolYearEnrollment(
      enrollmentProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
