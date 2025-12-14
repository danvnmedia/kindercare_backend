import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface SubjectProps {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateSubjectData = Omit<SubjectProps, "createdAt" | "updatedAt">;

export class Subject extends Entity<SubjectProps> {
  // --- Getters ---
  get name(): string {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  // --- Domain Methods ---

  public updateName(name: string): void {
    if (!name || name.trim().length < 1) {
      throw new Error("Subject name is required");
    }
    this.props.name = name.trim();
    this.touch();
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  // --- Factory Method ---

  public static create(
    props: Optional<SubjectProps, "createdAt" | "updatedAt">,
    id?: string,
  ): Subject {
    // Validation
    if (!props.name || props.name.trim().length < 1) {
      throw new Error("Subject name is required");
    }

    const subjectProps: SubjectProps = {
      ...props,
      name: props.name.trim(),
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    };

    return new Subject(subjectProps, id ? new UniqueEntityID(id) : undefined);
  }
}
