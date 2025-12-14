import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Class } from "./class.entity";
import { Subject } from "./subject.entity";
import { Teacher } from "@/domain/user-management/entities/teacher.entity";

export interface ClassTeacherProps {
  classId: string;
  teacherId: string;
  subjectId: string;
  // Optional loaded relations
  class?: Class;
  teacher?: Teacher;
  subject?: Subject;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassTeacherData = Pick<ClassTeacherProps, "classId" | "teacherId" | "subjectId">;

export class ClassTeacher extends Entity<ClassTeacherProps> {
  // --- Getters ---
  get classId(): string {
    return this.props.classId;
  }

  get teacherId(): string {
    return this.props.teacherId;
  }

  get subjectId(): string {
    return this.props.subjectId;
  }

  get class(): Class | undefined {
    return this.props.class;
  }

  get teacher(): Teacher | undefined {
    return this.props.teacher;
  }

  get subject(): Subject | undefined {
    return this.props.subject;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Returns a unique composite key for this assignment
   */
  public getCompositeKey(): string {
    return `${this.props.classId}-${this.props.teacherId}-${this.props.subjectId}`;
  }

  /**
   * Checks if this assignment matches the given criteria
   */
  public matches(classId: string, teacherId: string, subjectId: string): boolean {
    return (
      this.props.classId === classId &&
      this.props.teacherId === teacherId &&
      this.props.subjectId === subjectId
    );
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<ClassTeacherProps, "createdAt" | "updatedAt" | "class" | "teacher" | "subject">,
    id?: string,
  ): ClassTeacher {
    // Validation
    if (!props.classId) {
      throw new Error("Class ID is required");
    }
    if (!props.teacherId) {
      throw new Error("Teacher ID is required");
    }
    if (!props.subjectId) {
      throw new Error("Subject ID is required");
    }

    const classTeacherProps: ClassTeacherProps = {
      ...props,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    // For composite key entities, use a composite ID if not provided
    const entityId = id ?? `${props.classId}-${props.teacherId}-${props.subjectId}`;
    return new ClassTeacher(classTeacherProps, new UniqueEntityID(entityId));
  }
}
