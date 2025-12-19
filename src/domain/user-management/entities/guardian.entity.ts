import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { Student } from "./student.entity"; // Assuming Student entity is now in entities/
import { Gender } from "../enums/gender.enum";

// Interfaces related to guardian-student relationships
export interface GuardianRelationship {
  id: string;
  name: string;
}

export interface GuardianStudent {
  student: Student;
  guardianRelationship: GuardianRelationship;
}

export interface GuardianRelationshipType {
  id: string; // "FATHER", "MOTHER", "GUARDIAN"
  name: string; // "Bố", "Mẹ", "Người giám hộ"
  description: string | null;
}

// Properties of the Guardian entity
export interface GuardianProps {
  fullName: string;
  email: string | null;
  phoneNumber: string;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  occupation: string | null;
  workAddress: string | null;
  spouseId: string | null; // ID of the spouse guardian
  userId: string | null; // ID of the associated user account
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  spouse?: Guardian; // Eager-loaded spouse data - handled by repository
  children?: GuardianStudent[]; // Eager-loaded children data - handled by repository
}

// Data for updating a guardian
export type UpdateGuardianData = Partial<
  Omit<GuardianProps, "id" | "createdAt" | "updatedAt" | "isArchived">
>;

export class Guardian extends Entity<GuardianProps> {
  // --- Getters ---
  get fullName(): string {
    return this.props.fullName;
  }
  get email(): string | null {
    return this.props.email;
  }
  get phoneNumber(): string {
    return this.props.phoneNumber;
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
  get occupation(): string | null {
    return this.props.occupation;
  }
  get workAddress(): string | null {
    return this.props.workAddress;
  }
  get spouseId(): string | null {
    return this.props.spouseId;
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

  // --- Domain Logic (Instance Methods) ---

  /**
   * Updates the guardian's profile information.
   * @param updates - The data to update.
   */
  public updateProfile(updates: UpdateGuardianData): void {
    // Basic validation for spouseId if it's being updated
    if (updates.spouseId && updates.spouseId === this.id) {
      throw new Error("Guardian cannot be spouse of themselves");
    }

    if (updates.fullName) this.props.fullName = updates.fullName;
    if (updates.email !== undefined) this.props.email = updates.email;
    if (updates.phoneNumber !== undefined)
      this.props.phoneNumber = updates.phoneNumber;
    if (updates.address !== undefined) this.props.address = updates.address;
    if (updates.dateOfBirth !== undefined)
      this.props.dateOfBirth = updates.dateOfBirth;
    if (updates.gender !== undefined) this.props.gender = updates.gender;
    if (updates.occupation !== undefined)
      this.props.occupation = updates.occupation;
    if (updates.workAddress !== undefined)
      this.props.workAddress = updates.workAddress;
    if (updates.spouseId !== undefined) this.props.spouseId = updates.spouseId;
    if (updates.userId !== undefined) this.props.userId = updates.userId;

    this.touch();
  }

  /**
   * Links a spouse to this guardian.
   * @param spouseId - The ID of the spouse guardian.
   */
  public linkSpouse(spouseId: string): void {
    this.validateSelfSpouse(spouseId);
    this.props.spouseId = spouseId;
    this.touch();
  }

  /**
   * Unlinks the spouse from this guardian.
   */
  public unlinkSpouse(): void {
    this.props.spouseId = null;
    this.touch();
  }

  /**
   * Archives the guardian (soft delete).
   */
  public archive(): void {
    this.props.isArchived = true;
    this.touch();
  }

  /**
   * Restores the guardian from the archive.
   */
  public restore(): void {
    this.props.isArchived = false;
    this.touch();
  }

  /**
   * Checks if the guardian has a spouse.
   */
  public hasSpouse(): boolean {
    return this.props.spouseId !== null;
  }

  /**
   * Checks if the guardian has an associated user account.
   */
  public hasUserAccount(): boolean {
    return this.props.userId !== null;
  }

  /**
   * Updates the 'updatedAt' timestamp.
   */
  private touch(): void {
    this.props.updatedAt = new Date();
  }

  /**
   * Validates that spouse is not the same as guardian.
   */
  private validateSelfSpouse(spouseId: string): void {
    if (this.id === spouseId) {
      throw new Error("Guardian cannot be spouse of themselves");
    }
  }

  // --- Static Helper Methods ---

  /**
   * Checks if two guardians are spouses.
   * Note: This checks for a one-way link. For a mutual link, check both directions.
   */
  public static areSpouses(guardian1: Guardian, guardian2: Guardian): boolean {
    return (
      guardian1.spouseId === guardian2.id || guardian2.spouseId === guardian1.id
    );
  }

  /**
   * Gets a display name for a guardian relationship ID.
   */
  public static getGuardianType(relationshipId: string): string {
    const types: Record<string, string> = {
      FATHER: "Father",
      MOTHER: "Mother",
      GUARDIAN: "Guardian",
    };
    return types[relationshipId] || "Guardian";
  }

  /**
   * Validates a guardian relationship ID.
   */
  public static validateRelationshipId(relationshipId: string): boolean {
    const validRelationships = ["FATHER", "MOTHER", "GUARDIAN"];
    return validRelationships.includes(relationshipId);
  }

  // --- Factory Method ---

  /**
   * Creates a new Guardian entity.
   * @param props - The properties of the guardian.
   * @param id - An optional ID.
   * @returns A new Guardian instance.
   */
  public static create(
    props: Optional<GuardianProps, "createdAt" | "updatedAt" | "isArchived">,
    id?: string,
  ): Guardian {
    // Basic validation
    if (!props.fullName || props.fullName.trim().length < 2) {
      throw new Error(
        "Full name is required and must be at least 2 characters.",
      );
    }
    // Email is optional, but if provided must be valid
    if (props.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new Error("Email must be a valid email address.");
    }
    if (!props.phoneNumber || !/^\+[1-9]\d{1,14}$/.test(props.phoneNumber)) {
      throw new Error(
        "Phone number is required and must be in E.164 format (e.g., +84912345678).",
      );
    }
    if (props.gender && !Object.values(Gender).includes(props.gender)) {
      throw new Error("Gender must be MALE, FEMALE, or OTHER.");
    }

    const guardianProps: GuardianProps = {
      ...props,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Guardian(guardianProps, id ? new UniqueEntityID(id) : undefined);
  }
}
