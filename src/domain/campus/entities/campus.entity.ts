import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { assertValidIanaTimeZone } from "@/core/time/campus-time-zone";
import { Optional } from "@/core/types/optional";

export interface CampusProps {
  name: string;
  address: string | null;
  phoneNumber: string | null;
  timeZone: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateCampusData = Partial<
  Omit<CampusProps, "createdAt" | "updatedAt">
>;

export class Campus extends Entity<CampusProps> {
  // --- Getters ---

  get name(): string {
    return this.props.name;
  }

  get address(): string | null {
    return this.props.address;
  }

  get phoneNumber(): string | null {
    return this.props.phoneNumber;
  }

  get timeZone(): string {
    return this.props.timeZone;
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

  // --- Domain Methods ---

  public update(data: UpdateCampusData): void {
    if (data.name !== undefined) {
      this.validateName(data.name);
      this.props.name = data.name.trim();
    }

    if (data.address !== undefined) {
      this.props.address = data.address?.trim() || null;
    }

    if (data.phoneNumber !== undefined) {
      if (data.phoneNumber !== null) {
        this.validatePhoneNumber(data.phoneNumber);
      }
      this.props.phoneNumber = data.phoneNumber;
    }

    if (data.timeZone !== undefined) {
      this.validateTimeZone(data.timeZone);
      this.props.timeZone = data.timeZone;
    }

    if (data.isArchived !== undefined) {
      this.props.isArchived = data.isArchived;
    }

    this.touch();
  }

  public archive(): void {
    if (this.props.isArchived) {
      return; // Already archived
    }
    this.props.isArchived = true;
    this.touch();
  }

  public unarchive(): void {
    if (!this.props.isArchived) {
      return; // Already not archived
    }
    this.props.isArchived = false;
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Validation ---

  private validateName(name: string): void {
    if (!name || name.trim().length < 1) {
      throw new Error("Campus name is required");
    }
    if (name.trim().length > 200) {
      throw new Error("Campus name must be at most 200 characters");
    }
  }

  private validatePhoneNumber(phoneNumber: string): void {
    // E.164 format validation
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(phoneNumber)) {
      throw new Error(
        "Phone number must be in E.164 format (e.g., +84901234567)",
      );
    }
  }

  private validateTimeZone(timeZone: string): void {
    assertValidIanaTimeZone(timeZone);
  }

  // --- Factory Method ---

  public static create(
    props: Optional<
      CampusProps,
      | "createdAt"
      | "updatedAt"
      | "isArchived"
      | "address"
      | "phoneNumber"
      | "timeZone"
    >,
    id?: string,
  ): Campus {
    // Validation
    if (!props.name || props.name.trim().length < 1) {
      throw new Error("Campus name is required");
    }

    if (props.name.trim().length > 200) {
      throw new Error("Campus name must be at most 200 characters");
    }

    if (props.phoneNumber) {
      const e164Regex = /^\+[1-9]\d{1,14}$/;
      if (!e164Regex.test(props.phoneNumber)) {
        throw new Error(
          "Phone number must be in E.164 format (e.g., +84901234567)",
        );
      }
    }

    const timeZone = props.timeZone ?? "Asia/Ho_Chi_Minh";
    assertValidIanaTimeZone(timeZone);

    const campusProps: CampusProps = {
      ...props,
      name: props.name.trim(),
      address: props.address?.trim() || null,
      phoneNumber: props.phoneNumber || null,
      timeZone,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Campus(campusProps, id ? new UniqueEntityID(id) : undefined);
  }
}
