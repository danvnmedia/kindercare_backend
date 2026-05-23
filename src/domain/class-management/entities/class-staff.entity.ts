import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { ClassStaffRole } from "../enums/class-staff-role.enum";
import { Class } from "./class.entity";
import { Staff } from "@/domain/user-management/entities/staff.entity";

export interface ClassStaffProps {
  classId: string;
  staffId: string;
  role: ClassStaffRole;
  // Optional loaded relations
  class?: Class;
  staff?: Staff;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassStaffData = Pick<
  ClassStaffProps,
  "classId" | "staffId" | "role"
>;

export class ClassStaff extends Entity<ClassStaffProps> {
  // --- Getters ---
  get classId(): string {
    return this.props.classId;
  }

  get staffId(): string {
    return this.props.staffId;
  }

  get role(): ClassStaffRole {
    return this.props.role;
  }

  get class(): Class | undefined {
    return this.props.class;
  }

  get staff(): Staff | undefined {
    return this.props.staff;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  /**
   * Returns a unique composite key for this assignment.
   * After the Subject-removal refactor, the natural key is (classId, staffId).
   */
  public getCompositeKey(): string {
    return `${this.props.classId}-${this.props.staffId}`;
  }

  /**
   * Checks if this assignment matches the given class/staff pair.
   */
  public matches(classId: string, staffId: string): boolean {
    return this.props.classId === classId && this.props.staffId === staffId;
  }

  /**
   * Returns a new ClassStaff instance with the role replaced.
   *
   * ClassStaff is immutable across role changes: callers receive a fresh
   * entity rather than mutating the receiver, so older references (for
   * example, in-flight DTO mapping) keep observing the prior role.
   * `updatedAt` is bumped on the new instance; the identity (classId,
   * staffId) is preserved.
   */
  public changeRole(newRole: ClassStaffRole): ClassStaff {
    return ClassStaff.create(
      {
        classId: this.props.classId,
        staffId: this.props.staffId,
        role: newRole,
        class: this.props.class,
        staff: this.props.staff,
        createdAt: this.props.createdAt,
        updatedAt: new Date(),
      },
      this.id.toString(),
    );
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      ClassStaffProps,
      "createdAt" | "updatedAt" | "class" | "staff"
    >,
    id?: string,
  ): ClassStaff {
    if (!props.classId) {
      throw new Error("Class ID is required");
    }
    if (!props.staffId) {
      throw new Error("Staff ID is required");
    }
    if (!props.role) {
      throw new Error("Role is required");
    }
    if (!Object.values(ClassStaffRole).includes(props.role)) {
      throw new Error(`Invalid role: ${props.role}`);
    }

    const classStaffProps: ClassStaffProps = {
      ...props,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    // Composite-key entity: synth an ID from the natural key when none is given.
    const entityId = id ?? `${props.classId}-${props.staffId}`;
    return new ClassStaff(classStaffProps, new UniqueEntityID(entityId));
  }
}
