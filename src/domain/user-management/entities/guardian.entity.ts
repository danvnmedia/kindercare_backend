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
  id: string;
  name: string;
  description: string | null;
}

// Properties of the Guardian entity
export interface GuardianProps {
  campusId: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  address: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  occupation: string | null;
  workAddress: string | null;
  userId: string | null; // ID of the associated user account
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  children?: GuardianStudent[]; // Eager-loaded children data - handled by repository
}

// Data for updating a guardian (campusId is immutable)
export type UpdateGuardianData = Partial<
  Omit<
    GuardianProps,
    "id" | "campusId" | "createdAt" | "updatedAt" | "isArchived"
  >
>;

export class Guardian extends Entity<GuardianProps> {
  // --- Getters ---
  get campusId(): string {
    return this.props.campusId;
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
    if (updates.userId !== undefined) this.props.userId = updates.userId;

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

  // --- Factory Method ---

  /**
   * Creates a new Guardian entity.
   * @param props - The properties of the guardian.
   * @param id - An optional ID.
   * @returns A new Guardian instance.
   */
  public static create(
    props: Optional<
      GuardianProps,
      "createdAt" | "updatedAt" | "isArchived" | "userId"
    >,
    id?: string,
  ): Guardian {
    // Validation
    if (!props.campusId) {
      throw new Error("Campus ID is required for guardian.");
    }
    if (!props.fullName || props.fullName.trim().length < 2) {
      throw new Error(
        "Full name is required and must be at least 2 characters.",
      );
    }
    if (!props.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.email)) {
      throw new Error("Email is required and must be a valid email address.");
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
      userId: props.userId ?? null,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Guardian(guardianProps, id ? new UniqueEntityID(id) : undefined);
  }

  // Reconstitute from persistence without re-running invariants.
  public static reconstitute(props: GuardianProps, id: string): Guardian {
    return new Guardian(props, new UniqueEntityID(id));
  }
}
