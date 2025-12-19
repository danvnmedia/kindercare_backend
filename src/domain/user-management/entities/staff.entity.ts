import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Gender } from "../enums/gender.enum";
import { StaffType } from "../enums/staff-type.enum";

// Properties of the Staff entity
export interface StaffProps {
  fullName: string;
  email: string;
  phoneNumber: string;
  staffType: StaffType;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  startDate: Date | null;
  userId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data for updating a staff
export type UpdateStaffData = Partial<
  Omit<
    StaffProps,
    "id" | "createdAt" | "updatedAt" | "isArchived" | "email" | "phoneNumber"
  >
>;

export class Staff extends Entity<StaffProps> {
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
  get staffType(): StaffType {
    return this.props.staffType;
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
   * Updates the staff's profile information.
   * @param updates - The data to update.
   */
  public updateProfile(updates: UpdateStaffData): void {
    if (updates.fullName) this.props.fullName = updates.fullName;
    if (updates.staffType) this.props.staffType = updates.staffType;
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
   * Changes the staff's type.
   * @param newType - The new staff type.
   */
  public changeType(newType: StaffType): void {
    this.props.staffType = newType;
    this.touch();
  }

  /**
   * Links a user account to this staff.
   * @param userId - The user ID to link.
   */
  public linkUser(userId: string): void {
    this.props.userId = userId;
    this.touch();
  }

  /**
   * Unlinks the user account from this staff.
   */
  public unlinkUser(): void {
    this.props.userId = null;
    this.touch();
  }

  /**
   * Checks if the staff has a linked user account.
   */
  public hasUserAccount(): boolean {
    return this.props.userId !== null;
  }

  /**
   * Archives the staff (soft delete).
   */
  public archive(): void {
    this.props.isArchived = true;
    this.touch();
  }

  /**
   * Restores the staff from the archive.
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
   * Gets the display name for a staff type.
   * @param type - The staff type.
   */
  public static getTypeDisplayName(type: StaffType): string {
    const displayNames: Record<StaffType, string> = {
      [StaffType.TEACHER]: "Giáo viên",
      [StaffType.NURSE]: "Y tá",
      [StaffType.PRINCIPAL]: "Hiệu trưởng",
      [StaffType.STAFF]: "Nhân viên",
    };
    return displayNames[type];
  }

  /**
   * Maps staff type to role ID.
   * @param type - The staff type.
   */
  public static getStaffRoleId(type: StaffType): string {
    const roleMap: Record<StaffType, string> = {
      [StaffType.TEACHER]: "teacher",
      [StaffType.NURSE]: "nurse",
      [StaffType.PRINCIPAL]: "principal",
      [StaffType.STAFF]: "staff",
    };
    return roleMap[type];
  }

  // --- Factory Method ---

  /**
   * Creates a new Staff entity.
   * @param props - The properties of the staff.
   * @param id - An optional ID.
   * @returns A new Staff instance.
   */
  public static create(
    props: Optional<
      StaffProps,
      "createdAt" | "updatedAt" | "isArchived" | "userId"
    >,
    id?: string,
  ): Staff {
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
      !props.staffType ||
      !Object.values(StaffType).includes(props.staffType)
    ) {
      throw new Error("A valid staff type is required.");
    }

    const staffProps: StaffProps = {
      ...props,
      userId: props.userId ?? null,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Staff(staffProps, id ? new UniqueEntityID(id) : undefined);
  }
}
