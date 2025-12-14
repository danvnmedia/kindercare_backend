# Entity Pattern

> Domain entities. Located in `src/domain/{module}/`

---

## Base Entity

Located in `src/core/entities/entity.ts`

```typescript
import { UniqueEntityID } from './unique-entity-id';

export abstract class Entity<Props> {
  protected props: Props;
  protected _id: UniqueEntityID;

  protected constructor(props: Props, id?: UniqueEntityID) {
    this.props = props;
    this._id = id ?? new UniqueEntityID();
  }

  get id(): string {
    return this._id.toString();
  }

  public toPlain(): Record<string, any> {
    const plainObject: Record<string, any> = { id: this.id };
    // Recursively convert nested entities and value objects
    for (const key in this.props) {
      const value = this.props[key];
      if (value?.toPlain) {
        plainObject[key] = value.toPlain();
      } else {
        plainObject[key] = value;
      }
    }
    return plainObject;
  }
}
```

---

## Domain Entity

Domain entities follow a standard structure with specific patterns to maintain consistency across the system:

```typescript
import { Entity } from '@/core/entities/entity';
import { UniqueEntityID } from '@/core/entities/unique-entity-id';

// Enum definitions for standardized values
export enum EntityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ARCHIVED = 'archived',
}

// Properties interface - defines the structure of entity data
export interface EntityProps {
  name: string;
  description: string;
  status: EntityStatus;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class EntityName extends Entity<EntityProps> {
  // Getters for accessing properties
  get name() {
    return this.props.name;
  }

  get description() {
    return this.props.description;
  }

  get status() {
    return this.props.status;
  }

  get isArchived() {
    return this.props.isArchived;
  }

  get createdAt() {
    return this.props.createdAt;
  }

  get updatedAt() {
    return this.props.updatedAt;
  }

  // Domain methods containing business logic
  public archive(): void {
    this.props.isArchived = true;
    this.props.updatedAt = new Date();
  }

  public unarchive(): void {
    this.props.isArchived = false;
    this.props.updatedAt = new Date();
  }

  public updateInfo(name?: string, description?: string): void {
    if (name) this.props.name = name;
    if (description) this.props.description = description;
    this.props.updatedAt = new Date();
  }

  // Factory method for proper entity creation with defaults
  public static create(props: EntityProps, id?: string): EntityName {
    const entity = new EntityName(
      {
        ...props,
        isArchived: props.isArchived ?? false,
        createdAt: props.createdAt ?? new Date(),
        updatedAt: props.updatedAt ?? new Date(),
      },
      id ? new UniqueEntityID(id) : undefined,
    );

    return entity;
  }
}
```

---

## Key Patterns

1. **Props interface**: All properties are organized in a dedicated interface
2. **Getters**: Provide read-only access to properties for encapsulation
3. **Domain methods**: Contain business logic that operates on the entity's state
4. **Static validation methods**: Contain validation rules and business rules outside the entity class
5. **Factory method**: `create()` method with sensible defaults and proper initialization
6. **Enums**: Define standardized values for specific fields
7. **Archival pattern**: Support soft deletion with `isArchived` flag
8. **Timestamps**: Include `createdAt` and `updatedAt` for audit trail
9. **Immutable by design**: Properties are accessed via getters, not directly
10. **Domain-focused**: Methods represent business operations, not data access
