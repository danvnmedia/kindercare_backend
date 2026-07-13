import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Class } from "./class.entity";
import { SchoolYearEnrollment } from "./school-year-enrollment.entity";
import { Student } from "@/domain/user-management/entities/student.entity";
import { ExitReason } from "../enums/exit-reason.enum";
import { EnrollmentAlreadyClosedException } from "../exceptions/enrollment-already-closed.exception";
import { InvalidEndDateException } from "../exceptions/invalid-end-date.exception";
import {
  EnrollmentCancellationReason,
  isEnrollmentCancellationReason,
} from "../enums/enrollment-cancellation-reason.enum";
import { EnrollmentEffectiveStatus } from "../enums/enrollment-effective-status.enum";
import { deriveEnrollmentEffectiveStatus } from "../enrollment-effective-status";

export interface EnrollmentProps {
  classId: string;
  studentId: string;
  schoolYearEnrollmentId: string;
  enrollmentDate: Date;
  endDate: Date | null;
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
  snapshotClassName: string | null;
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

  get snapshotClassName(): string | null {
    return this.props.snapshotClassName;
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

  /**
   * @deprecated This reports structural openness, not calendar-effective
   * activity. Use isStructurallyOpen() or isEffectiveOn(referenceDate).
   */
  public isActive(): boolean {
    return this.isStructurallyOpen();
  }

  public isStructurallyOpen(): boolean {
    return this.props.endDate === null && this.props.cancelledAt === null;
  }

  public getEffectiveStatus(referenceDate: Date): EnrollmentEffectiveStatus {
    return deriveEnrollmentEffectiveStatus({
      enrollmentDate: this.props.enrollmentDate,
      endDate: this.props.endDate,
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
  }): Enrollment {
    if (
      this.getEffectiveStatus(input.cancelledAt) !==
      EnrollmentEffectiveStatus.UPCOMING
    ) {
      throw new Error("Only an upcoming enrollment can be cancelled");
    }

    return Enrollment.create(
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
   * Schedules an inclusive closure date, including a future date. This is
   * reserved for atomic transfer/lifecycle workflows that create the next
   * non-overlapping period at the same time.
   */
  public scheduleClosure(endDate: Date, reason: ExitReason): Enrollment {
    if (!this.isStructurallyOpen()) {
      throw new EnrollmentAlreadyClosedException(this.id);
    }

    const endDay = Enrollment.toDateOnly(endDate);
    const startDay = Enrollment.toDateOnly(this.props.enrollmentDate);
    if (endDay.getTime() < startDay.getTime()) {
      throw new InvalidEndDateException(
        `endDate (${endDay.toISOString().slice(0, 10)}) is before enrollmentDate (${startDay.toISOString().slice(0, 10)})`,
      );
    }

    return Enrollment.create(
      {
        ...this.props,
        endDate: endDay,
        exitReason: reason,
        historicalFinalizedAt: endDay,
        updatedAt: new Date(),
      },
      this.id,
    );
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
    if (!this.isStructurallyOpen()) {
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
        snapshotStudentFullName: this.props.snapshotStudentFullName,
        snapshotStudentCode: this.props.snapshotStudentCode,
        snapshotStudentNickname: this.props.snapshotStudentNickname,
        snapshotClassName: this.props.snapshotClassName,
        snapshotGradeLevelName: this.props.snapshotGradeLevelName,
        snapshotGradeLevelOrder: this.props.snapshotGradeLevelOrder,
        snapshotSchoolYearName: this.props.snapshotSchoolYearName,
        snapshotSchoolYearStartDate: this.props.snapshotSchoolYearStartDate,
        snapshotSchoolYearEndDate: this.props.snapshotSchoolYearEndDate,
        snapshotCapturedAt: this.props.snapshotCapturedAt,
        historicalFinalizedAt: endDay,
        archivedAt: this.props.archivedAt,
        redactedAt: this.props.redactedAt,
        retentionExpiresAt: this.props.retentionExpiresAt,
        retentionPolicySource: this.props.retentionPolicySource,
        legalHold: this.props.legalHold,
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
      | "cancelledAt"
      | "cancellationReason"
      | "cancellationNote"
      | "cancelledByUserId"
      | "cancelledByFullName"
      | "snapshotStudentFullName"
      | "snapshotStudentCode"
      | "snapshotStudentNickname"
      | "snapshotClassName"
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
    const cancelledAt = props.cancelledAt ?? null;
    const cancellationReason = props.cancellationReason ?? null;
    const cancellationNote = props.cancellationNote?.trim() || null;
    const cancelledByUserId = props.cancelledByUserId?.trim() || null;
    const cancelledByFullName = props.cancelledByFullName?.trim() || null;

    // XOR invariant: endDate and exitReason must both be set or both be null.
    if ((endDate === null) !== (exitReason === null)) {
      throw new Error(
        "Enrollment endDate and exitReason must both be set or both be null",
      );
    }

    const hasCancellationDetails =
      cancellationReason !== null ||
      cancellationNote !== null ||
      cancelledByUserId !== null ||
      cancelledByFullName !== null;

    if (cancelledAt === null && hasCancellationDetails) {
      throw new Error("Enrollment cancellation details require cancelledAt");
    }
    if (
      cancellationReason !== null &&
      !isEnrollmentCancellationReason(cancellationReason)
    ) {
      throw new Error("Enrollment cancellationReason is invalid");
    }
    if (
      cancelledAt !== null &&
      (cancellationReason === null || cancelledByUserId === null)
    ) {
      throw new Error(
        "Cancelled enrollment requires cancellationReason and cancelledByUserId",
      );
    }
    if (cancellationNote !== null && cancellationNote.length > 500) {
      throw new Error(
        "Enrollment cancellationNote must be at most 500 characters",
      );
    }

    const enrollmentProps: EnrollmentProps = {
      ...props,
      endDate,
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
      snapshotClassName: props.snapshotClassName ?? null,
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

    return new Enrollment(
      enrollmentProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
