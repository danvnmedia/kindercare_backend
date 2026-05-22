import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Gender } from "../enums/gender.enum";

// Format for staff code: ST-YYYY-XXXXXX (e.g., ST-2025-000001)
const STAFF_CODE_PATTERN = /^ST-\d{4}-\d{6}$/;

// Properties of the Staff entity
export interface StaffProps {
  campusId: string;
  staffCode: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  staffTypeId: string | null;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  startDate: Date | null;
  userId: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data for updating a staff (campusId and staffCode are immutable)
export type UpdateStaffData = Partial<
  Omit<
    StaffProps,
    "id" | "campusId" | "staffCode" | "createdAt" | "updatedAt" | "isArchived"
  >
>;

export class Staff extends Entity<StaffProps> {
  // --- Getters ---
  get campusId(): string {
    return this.props.campusId;
  }
  get staffCode(): string {
    return this.props.staffCode;
  }
  get fullName(): string {
    return this.props.fullName;
  }
  get email(): string {
    return this.props.email;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
  }
  get staffTypeId(): string | null {
    return this.props.staffTypeId;
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
    if (updates.email !== undefined) this.props.email = updates.email;
    if (updates.phoneNumber !== undefined)
      this.props.phoneNumber = updates.phoneNumber;
    if (updates.staffTypeId !== undefined)
      this.props.staffTypeId = updates.staffTypeId;
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
   * @param staffTypeId - The new staff type ID (or null to clear).
   */
  public changeStaffType(staffTypeId: string | null): void {
    this.props.staffTypeId = staffTypeId;
    this.touch();
  }

  /**
   * Checks if the staff has a staff type assigned.
   */
  public hasStaffType(): boolean {
    return this.props.staffTypeId !== null;
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
      "createdAt" | "updatedAt" | "isArchived" | "userId" | "staffTypeId"
    >,
    id?: string,
  ): Staff {
    // Validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for staff.");
    }
    if (!props.staffCode || !STAFF_CODE_PATTERN.test(props.staffCode)) {
      throw new Error(
        "A valid staff code in format ST-YYYY-XXXXXX is required (e.g., ST-2025-000001).",
      );
    }
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

    const staffProps: StaffProps = {
      ...props,
      staffTypeId: props.staffTypeId ?? null,
      userId: props.userId ?? null,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Staff(staffProps, id ? new UniqueEntityID(id) : undefined);
  }
}
