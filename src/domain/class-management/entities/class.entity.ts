import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";
import { GradeLevel } from "./grade-level.entity";
import { SchoolYear } from "./school-year.entity";

export interface ClassProps {
  name: string;
  description: string | null;
  gradeLevelId: string;
  schoolYearId: string;
  // Optional loaded relations
  gradeLevel?: GradeLevel;
  schoolYear?: SchoolYear;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateClassData = Omit<ClassProps, "createdAt" | "updatedAt" | "gradeLevel" | "schoolYear">;
export type UpdateClassData = Partial<Pick<ClassProps, "name" | "description">>;

export class Class extends Entity<ClassProps> {
  // --- Getters ---
  get name(): string {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get gradeLevelId(): string {
    return this.props.gradeLevelId;
  }

  get schoolYearId(): string {
    return this.props.schoolYearId;
  }

  get gradeLevel(): GradeLevel | undefined {
    return this.props.gradeLevel;
  }

  get schoolYear(): SchoolYear | undefined {
    return this.props.schoolYear;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  public update(data: UpdateClassData): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length < 1) {
        throw new Error("Class name is required");
      }
      this.props.name = data.name.trim();
    }
    if (data.description !== undefined) {
      this.props.description = data.description?.trim() || null;
    }
    this.touch();
  }

  public getDisplayName(): string {
    if (this.props.gradeLevel) {
      return `${this.props.gradeLevel.name} - ${this.props.name}`;
    }
    return this.props.name;
  }

  public getFullDisplayName(): string {
    const parts: string[] = [];
    if (this.props.schoolYear) {
      parts.push(this.props.schoolYear.name);
    }
    if (this.props.gradeLevel) {
      parts.push(this.props.gradeLevel.name);
    }
    parts.push(this.props.name);
    return parts.join(" - ");
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<ClassProps, "createdAt" | "updatedAt" | "description" | "gradeLevel" | "schoolYear">,
    id?: string,
  ): Class {
    // Validation
    if (!props.name || props.name.trim().length < 1) {
      throw new Error("Class name is required");
    }
    if (!props.gradeLevelId) {
      throw new Error("Grade level is required");
    }
    if (!props.schoolYearId) {
      throw new Error("School year is required");
    }

    const classProps: ClassProps = {
      ...props,
      name: props.name.trim(),
      description: props.description?.trim() || null,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Class(classProps, id ? new UniqueEntityID(id) : undefined);
  }
}
