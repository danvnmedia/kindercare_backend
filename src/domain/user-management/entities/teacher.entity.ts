import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Gender } from "../enums/gender.enum";
import { TeacherType } from "../enums/teacher-type.enum";

// Properties of the Teacher entity
export interface TeacherProps {
  fullName: string;
  email: string;
  phoneNumber: string;
  teacherType: TeacherType;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  startDate: Date | null;
  userId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data for updating a teacher
export type UpdateTeacherData = Partial<
  Omit<
    TeacherProps,
    "id" | "createdAt" | "updatedAt" | "isArchived" | "email" | "phoneNumber"
  >
>;

export class Teacher extends Entity<TeacherProps> {
  // --- Getters ---
  get fullName(): string {
    return this.props.fullName;
  }
  get email(): string {
    return this.props.email;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
  }
  get teacherType(): TeacherType {
    return this.props.teacherType;
  }
  get address(): string | null {
    return this.props.address;
  }
  get dateOfBirth(): Date | null {
    return this.props.dateOfBirth;
  }
  get gender(): Gender | null {
    return this.props.gender;
  }
  get startDate(): Date | null {
    return this.props.startDate;
  }
  get userId(): string | null {
    return this.props.userId;
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
   * Updates the teacher's profile information.
   * @param updates - The data to update.
   */
  public updateProfile(updates: UpdateTeacherData): void {
    if (updates.fullName) this.props.fullName = updates.fullName;
    if (updates.teacherType) this.props.teacherType = updates.teacherType;
    if (updates.address !== undefined) this.props.address = updates.address;
    if (updates.dateOfBirth !== undefined)
      this.props.dateOfBirth = updates.dateOfBirth;
    if (updates.gender !== undefined) this.props.gender = updates.gender;
    if (updates.startDate !== undefined)
      this.props.startDate = updates.startDate;
    if (updates.userId !== undefined) this.props.userId = updates.userId;
    this.touch();
  }

  /**
   * Changes the teacher's type.
   * @param newType - The new teacher type.
   */
  public changeType(newType: TeacherType): void {
    this.props.teacherType = newType;
    this.touch();
  }

  /**
   * Links a user account to this teacher.
   * @param userId - The user ID to link.
   */
  public linkUser(userId: string): void {
    this.props.userId = userId;
    this.touch();
  }

  /**
   * Unlinks the user account from this teacher.
   */
  public unlinkUser(): void {
    this.props.userId = null;
    this.touch();
  }

  /**
   * Checks if the teacher has a linked user account.
   */
  public hasUserAccount(): boolean {
    return this.props.userId !== null;
  }

  /**
   * Archives the teacher (soft delete).
   */
  public archive(): void {
    this.props.isArchived = true;
    this.touch();
  }

  /**
   * Restores the teacher from the archive.
   */
  public restore(): void {
    this.props.isArchived = false;
    this.touch();
  }

  /**
   * Updates the 'updatedAt' timestamp.
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Static Helpers ---

  /**
   * Gets the display name for a teacher type.
   * @param type - The teacher type.
   */
  public static getTypeDisplayName(type: TeacherType): string {
    const displayNames: Record<TeacherType, string> = {
      [TeacherType.TEACHER]: "Giáo viên",
      [TeacherType.NURSE]: "Y tá",
      [TeacherType.PRINCIPAL]: "Hiệu trưởng",
      [TeacherType.STAFF]: "Nhân viên",
    };
    return displayNames[type];
  }

  /**
   * Maps teacher type to role ID.
   * @param type - The teacher type.
   */
  public static getTeacherRoleId(type: TeacherType): string {
    const roleMap: Record<TeacherType, string> = {
      [TeacherType.TEACHER]: "teacher",
      [TeacherType.NURSE]: "nurse",
      [TeacherType.PRINCIPAL]: "principal",
      [TeacherType.STAFF]: "staff",
    };
    return roleMap[type];
  }

  // --- Factory Method ---

  /**
   * Creates a new Teacher entity.
   * @param props - The properties of the teacher.
   * @param id - An optional ID.
   * @returns A new Teacher instance.
   */
  public static create(
    props: Optional<
      TeacherProps,
      "createdAt" | "updatedAt" | "isArchived" | "userId"
    >,
    id?: string,
  ): Teacher {
    // Validation
    if (!props.fullName || props.fullName.trim().length < 2) {
      throw new Error(
        "Full name is required and must be at least 2 characters.",
      );
    }
    if (!props.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new Error("A valid email address is required.");
    }
    if (!props.phoneNumber || !/^\+[1-9]\d{1,14}$/.test(props.phoneNumber)) {
      throw new Error(
        "A valid phone number in E.164 format is required (e.g., +84912345678).",
      );
    }
    if (
      !props.teacherType ||
      !Object.values(TeacherType).includes(props.teacherType)
    ) {
      throw new Error("A valid teacher type is required.");
    }

    const teacherProps: TeacherProps = {
      ...props,
      userId: props.userId ?? null,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Teacher(teacherProps, id ? new UniqueEntityID(id) : undefined);
  }
}
