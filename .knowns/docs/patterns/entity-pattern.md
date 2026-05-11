---
title: Entity Pattern
description: 'Domain entity structure: props interface, getters, factory, invariants, soft-delete and timestamp conventions'
createdAt: '2026-01-03T19:52:16.385Z'
updatedAt: '2026-05-05T17:34:22.278Z'
tags:
  - patterns
  - entity
  - domain
  - ddd
---

# Entity Pattern

> Domain entities are the heart of each module. Located at `src/domain/{module}/entities/{entity}.entity.ts`.

Entities encapsulate state **and** the rules that protect it. They are framework-agnostic — no NestJS, no Prisma, no class-validator. Mapping to/from persistence happens in the Prisma mapper layer (see [@doc/patterns/mapper-pattern](patterns/mapper-pattern)); validation of input shape happens in DTOs (see [@doc/patterns/dto-pattern](patterns/dto-pattern)).

## Two Entity Styles

The codebase has **two coexisting styles** depending on the module's age and complexity:

### Style A — `Entity<Props>` subclass (preferred)

The base class lives at `src/core/entities/entity.ts`. Most domain entities use this.

```typescript
import { Entity } from "@/core/entities/entity";
import { UniqueEntityID } from "@/core/entities/unique-entity-id";
import { Optional } from "@/core/types/optional";

export interface StudentProps {
  campusId: string;          // immutable
  studentCode: string;       // immutable
  fullName: string;
  email: string | null;
  // …
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type UpdateStudentData = Partial<
  Omit<StudentProps, "id" | "campusId" | "studentCode" | "createdAt" | "updatedAt" | "isArchived">
>;

export class Student extends Entity<StudentProps> {
  // 1. Getters — all reads go through them
  get fullName(): string { return this.props.fullName; }
  get isArchived(): boolean { return this.props.isArchived; }
  // …

  // 2. Domain methods — mutations are intentional and named
  public updateProfile(updates: UpdateStudentData): void { /* … */ this.touch(); }
  public archive(): void { this.props.isArchived = true; this.props.status = StudentStatus.DROPPED; this.touch(); }
  public restore(): void { this.props.isArchived = false; this.props.status = StudentStatus.ACTIVE; this.touch(); }

  private touch(): void { this.props.updatedAt = new Date(); }

  // 3. Factory — the only way to construct
  public static create(
    props: Optional<StudentProps, "createdAt" | "updatedAt" | "isArchived" | "status">,
    id?: string,
  ): Student {
    if (!props.campusId) throw new Error("Campus ID is required for student.");
    if (!props.fullName || props.fullName.trim().length < 2) {
      throw new Error("Full name is required and must be at least 2 characters.");
    }
    return new Student({
      ...props,
      status: props.status ?? StudentStatus.ACTIVE,
      isArchived: props.isArchived ?? false,
      createdAt: props.createdAt ?? new Date(),
      updatedAt: props.updatedAt ?? new Date(),
    }, id ? new UniqueEntityID(id) : undefined);
  }
}
```

### Style B — plain interface + static-method "entity service"

Used for simpler aggregate-less concepts where there is no per-instance state to defend (`Permission`, `Role`).

```typescript
// src/domain/rbac/entities/permission.entity.ts
export interface Permission {
  id: string;          // module.action format
  module: string;
  description: string | null;
  createdAt: Date;
}

export class PermissionEntity {
  static readonly VALID_MODULES = ["campus", "student", /* … */] as const;
  static readonly VALID_ACTIONS = ["create", "read", "update", "delete", "list", "manage", "assign", "export", "import"] as const;

  static validateId(id: string): void { /* throws if invalid */ }
  static parseId(id: string): { module: string; action: string } { /* … */ }
  static buildId(module: string, action: string): string { return `${module}.${action}`; }
  static create(data: CreatePermissionData): Permission { /* … */ }
}
```

Use Style B only when:

- The "entity" has no behaviour beyond construction/validation, and
- You want a plain object for ergonomic DI/serialization.

For everything else, use Style A.

## Conventions

### 1. Props interface is private; access via getters

The `props` are `protected` on `Entity<Props>`, never exposed directly. This keeps mutation channels visible (only domain methods mutate).

### 2. Mutations are named methods, not setters

Don't write `student.fullName = "..."`. Write `student.updateProfile({ fullName: "..." })`. The method bumps `updatedAt` and is the seam for invariants.

### 3. `touch()` updates `updatedAt`

Every mutation calls `this.touch()`. The Prisma mapper writes `student.updatedAt`, never relying on Prisma's `@updatedAt` alone, so the domain has the source of truth.

### 4. Factory enforces invariants

`create(props, id?)` is the only construction path. Invalid props throw plain `Error` (the use case catches and re-throws as `BadRequestException` — see [@doc/patterns/exception-pattern](patterns/exception-pattern)).

### 5. `UpdateXxxData` excludes immutable fields

`Omit` `id`, `campusId`, generated codes, `createdAt`, `updatedAt`, and lifecycle flags (`isArchived`, `isDeleted`). This makes the type the contract — you can't accidentally pass an immutable field.

### 6. Reconstitute from persistence

For repository → entity, `User.entity.ts` exposes a `reconstitute(props, id)` static. Most entities just reuse `create(props, id)` since the mapper already supplies the full props. Pick whichever is in the file you're working in and stay consistent within that entity.

## Lifecycle Flags — Which Variant?

The codebase uses **two distinct soft-delete patterns** depending on the entity:

| Flag | Used by | Meaning |
|------|---------|---------|
| `isArchived` | `Student`, `Staff`, `Guardian`, `GradeLevel`, `SchoolYear`, `StaffType`, `GuardianRelationship`, `PostCategory`, `Campus`, `Role` (implicit) | Hidden from default lists, recoverable via `restore()`. The entity remains queryable. |
| `isDeleted` + `deletedAt` | `Post`, `PostComment`, `File` | Append-only audit trail. The repository typically excludes these from queries; restoration is rare. |

See [@doc/architecture/audit-and-soft-delete](architecture/audit-and-soft-delete) for the full breakdown and when to use each.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Set `props` directly outside the entity | Use a domain method |
| Add Prisma types to props | Keep props framework-agnostic |
| Store DTOs on the entity | DTOs belong to the HTTP layer |
| Allow `campusId` mutation | Exclude it from `UpdateXxxData` |
| Skip the factory and construct via `new` | Constructor stays `protected`/private; `create()` is public |
| Use `setters` for fields | Name the operation: `archive`, `pin`, `submitForReview` |

## Reference Entities

| Entity | Notable patterns |
|--------|------------------|
| `Student.entity.ts` | Soft archive (`isArchived` + status enum), immutable code |
| `Staff.entity.ts` | E.164 phone validation in factory, `linkUser` / `unlinkUser` lifecycle |
| `Post.entity.ts` | Status state-machine (`publish`, `submitForReview`, `approve`, `reject`), pin/unpin, soft delete (`isDeleted` + `deletedAt`), content versioning |
| `User.entity.ts` | Has `reconstitute()` factory, multi-campus role assignments |
| `Permission.entity.ts` (Style B) | Plain interface + validation service |
| `Class.entity.ts` | Composite uniqueness (`campusId, schoolYearId, gradeLevelId, name`) |
