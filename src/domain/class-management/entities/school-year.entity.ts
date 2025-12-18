import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface SchoolYearProps {
  name: string;
  startDate: Date;
  endDate: Date;
  status: boolean; // true = active, false = inactive
  createdAt: Date;
  updatedAt: Date;
}

export type CreateSchoolYearData = Omit<
  SchoolYearProps,
  "createdAt" | "updatedAt" | "status"
>;
export type UpdateSchoolYearData = Partial<
  Omit<SchoolYearProps, "createdAt" | "updatedAt">
>;

export class SchoolYear extends Entity<SchoolYearProps> {
  // --- Getters ---
  get name(): string {
    return this.props.name;
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get status(): boolean {
    return this.props.status;
  }

  get isActive(): boolean {
    return this.props.status;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  public update(data: UpdateSchoolYearData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 1) {
        throw new Error("School year name is required");
      }
      this.props.name = data.name.trim();
    }
    if (data.startDate !== undefined) {
      this.props.startDate = data.startDate;
    }
    if (data.endDate !== undefined) {
      this.props.endDate = data.endDate;
    }
    if (data.status !== undefined) {
      this.props.status = data.status;
    }

    // Validate date range
    if (this.props.startDate >= this.props.endDate) {
      throw new Error("Start date must be before end date");
    }

    this.touch();
  }

  public activate(): void {
    this.props.status = true;
    this.touch();
  }

  public deactivate(): void {
    this.props.status = false;
    this.touch();
  }

  public isWithinDateRange(date: Date): boolean {
    return date >= this.props.startDate && date <= this.props.endDate;
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<SchoolYearProps, "createdAt" | "updatedAt" | "status">,
    id?: string,
  ): SchoolYear {
    // Validation
    if (!props.name || props.name.trim().length < 1) {
      throw new Error("School year name is required");
    }
    if (!props.startDate) {
      throw new Error("Start date is required");
    }
    if (!props.endDate) {
      throw new Error("End date is required");
    }
    if (props.startDate >= props.endDate) {
      throw new Error("Start date must be before end date");
    }

    const schoolYearProps: SchoolYearProps = {
      ...props,
      name: props.name.trim(),
      status: props.status ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new SchoolYear(
      schoolYearProps,
      id ? new UniqueEntityID(id) : undefined,
    );
  }
}
