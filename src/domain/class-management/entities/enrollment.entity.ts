import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Class } from "./class.entity";
import { Student } from "@/domain/user-management/entities/student.entity";

export interface EnrollmentProps {
  classId: string;
  studentId: string;
  enrollmentDate: Date;
  note: string | null;
  // Optional loaded relations
  class?: Class;
  student?: Student;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateEnrollmentData = Omit<EnrollmentProps, "createdAt" | "updatedAt" | "class" | "student">;
export type UpdateEnrollmentData = Partial<Pick<EnrollmentProps, "enrollmentDate" | "note">>;

export class Enrollment extends Entity<EnrollmentProps> {
  // --- Getters ---
  get classId(): string {
    return this.props.classId;
  }

  get studentId(): string {
    return this.props.studentId;
  }

  get enrollmentDate(): Date {
    return this.props.enrollmentDate;
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

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

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

  // --- Factory Method ---

  public static create(
    props: Optional<EnrollmentProps, "createdAt" | "updatedAt" | "note" | "class" | "student">,
    id?: string,
  ): Enrollment {
    // Validation
    if (!props.classId) {
      throw new Error("Class ID is required");
    }
    if (!props.studentId) {
      throw new Error("Student ID is required");
    }
    if (!props.enrollmentDate) {
      throw new Error("Enrollment date is required");
    }

    const enrollmentProps: EnrollmentProps = {
      ...props,
      note: props.note?.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Enrollment(enrollmentProps, id ? new UniqueEntityID(id) : undefined);
  }
}
