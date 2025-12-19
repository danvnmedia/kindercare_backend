import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Class } from "./class.entity";
import { Subject } from "./subject.entity";
import { Staff } from "@/domain/user-management/entities/staff.entity";

export interface ClassStaffProps {
  classId: string;
  staffId: string;
  subjectId: string;
  // Optional loaded relations
  class?: Class;
  staff?: Staff;
  subject?: Subject;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassStaffData = Pick<
  ClassStaffProps,
  "classId" | "staffId" | "subjectId"
>;

export class ClassStaff extends Entity<ClassStaffProps> {
  // --- Getters ---
  get classId(): string {
    return this.props.classId;
  }

  get staffId(): string {
    return this.props.staffId;
  }

  get subjectId(): string {
    return this.props.subjectId;
  }

  get class(): Class | undefined {
    return this.props.class;
  }

  get staff(): Staff | undefined {
    return this.props.staff;
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
    return `${this.props.classId}-${this.props.staffId}-${this.props.subjectId}`;
  }

  /**
   * Checks if this assignment matches the given criteria
   */
  public matches(
    classId: string,
    staffId: string,
    subjectId: string,
  ): boolean {
    return (
      this.props.classId === classId &&
      this.props.staffId === staffId &&
      this.props.subjectId === subjectId
    );
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      ClassStaffProps,
      "createdAt" | "updatedAt" | "class" | "staff" | "subject"
    >,
    id?: string,
  ): ClassStaff {
    // Validation
    if (!props.classId) {
      throw new Error("Class ID is required");
    }
    if (!props.staffId) {
      throw new Error("Staff ID is required");
    }
    if (!props.subjectId) {
      throw new Error("Subject ID is required");
    }

    const classStaffProps: ClassStaffProps = {
      ...props,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    // For composite key entities, use a composite ID if not provided
    const entityId =
      id ?? `${props.classId}-${props.staffId}-${props.subjectId}`;
    return new ClassStaff(classStaffProps, new UniqueEntityID(entityId));
  }
}
