import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Gender } from "../enums/gender.enum";
import { StudentStatus } from "../enums/student-status.enum";

// Properties of the Student entity
export interface StudentProps {
  campusId: string;
  studentCode: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  nickname: string | null;
  gender: Gender | null;
  status: StudentStatus;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data for updating a student (campusId is immutable)
export type UpdateStudentData = Partial<
  Omit<
    StudentProps,
    "id" | "campusId" | "createdAt" | "updatedAt" | "isArchived"
  >
>;

export class Student extends Entity<StudentProps> {
  get campusId(): string {
    return this.props.campusId;
  }
  get studentCode(): string {
    return this.props.studentCode;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phoneNumber(): string | null {
    return this.props.phoneNumber;
  }
  get address(): string | null {
    return this.props.address;
  }
  get dateOfBirth(): Date | null {
    return this.props.dateOfBirth;
  }
  get nickname(): string | null {
    return this.props.nickname;
  }
  get gender(): Gender | null {
    return this.props.gender;
  }
  get status(): StudentStatus {
    return this.props.status;
  }
  get isArchived(): boolean {
    return this.props.isArchived;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Logic ---

  /**
   * Updates the student's profile information.
   * @param updates - The data to update.
   */
  public updateProfile(updates: UpdateStudentData): void {
    if (updates.fullName) this.props.fullName = updates.fullName;
    if (updates.email !== undefined) this.props.email = updates.email;
    if (updates.phoneNumber !== undefined)
      this.props.phoneNumber = updates.phoneNumber;
    if (updates.address !== undefined) this.props.address = updates.address;
    if (updates.dateOfBirth !== undefined)
      this.props.dateOfBirth = updates.dateOfBirth;
    if (updates.nickname !== undefined) this.props.nickname = updates.nickname;
    if (updates.gender !== undefined) this.props.gender = updates.gender;
    if (updates.status) this.props.status = updates.status;

    this.touch();
  }

  /**
   * Archives the student (soft delete).
   */
  public archive(): void {
    this.props.isArchived = true;
    this.props.status = StudentStatus.DROPPED;
    this.touch();
  }

  /**
   * Restores the student from the archive.
   */
  public restore(): void {
    this.props.isArchived = false;
    this.props.status = StudentStatus.ACTIVE;
    this.touch();
  }

  /**
   * Updates the 'updatedAt' timestamp.
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  /**
   * Creates a new Student entity.
   * @param props - The properties of the student.
   * @param id - An optional ID.
   * @returns A new Student instance.
   */
  public static create(
    props: Optional<
      StudentProps,
      "createdAt" | "updatedAt" | "isArchived" | "status"
    >,
    id?: string,
  ): Student {
    // Campus validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for student.");
    }
    // Basic validation
    if (!props.fullName || props.fullName.trim().length < 2) {
      throw new Error(
        "Full name is required and must be at least 2 characters.",
      );
    }
    if (props.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new Error("Email, if provided, must be a valid email address.");
    }

    const studentProps: StudentProps = {
      ...props,
      status: props.status ?? StudentStatus.ACTIVE,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Student(studentProps, id ? new UniqueEntityID(id) : undefined);
  }
}

// This interface is returned by use-cases and represents a denormalized view
// of a student's guardian. It's kept here as it's directly related to the student domain.
export interface StudentGuardianInfo {
  guardianId: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  relationship: string;
  relationshipName: string;
}
