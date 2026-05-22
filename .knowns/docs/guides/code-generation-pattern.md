---
title: Code Generation Pattern
description: Sequential code generation using campus-scoped counter tables for entities like Student and Staff (both immutable)
createdAt: '2026-01-03T19:51:55.371Z'
updatedAt: '2026-04-21T17:16:53.095Z'
tags:
  - guides
  - pattern
  - code-generation
  - immutability
  - multi-campus
---

# Code Generation Pattern

> Sequential code generation using campus-scoped counter tables for entities like Student and Staff.

---

## Overview

Some entities require auto-generated codes that:

- Follow a specific format (e.g., `YYYY-XXXXXX` or `ST-YYYY-XXXXXX`)
- Are unique and sequential **within a campus**
- Reset based on a time period (e.g., yearly)
- Handle concurrent requests safely
- Are **immutable after creation** (no update path)

Two concrete generators exist today: `StudentCodeGeneratorService` (no prefix) and `StaffCodeGeneratorService` (`ST-` prefix). Both share the same campus-scoped counter-table pattern.

---

## Code Formats

### Student Code

| Component | Description | Example |
|-----------|-------------|---------|
| `YYYY` | 4-digit year | `2025` |
| `-` | Separator | `-` |
| `XXXXXX` | 6-digit sequence, zero-padded | `000001` |

**Full example**: `2025-000001`, `2025-000002`, ... `2026-000001`

### Staff Code

| Component | Description | Example |
|-----------|-------------|---------|
| `ST-` | Literal prefix | `ST-` |
| `YYYY` | 4-digit year | `2025` |
| `-` | Separator | `-` |
| `XXXXXX` | 6-digit sequence, zero-padded | `000001` |

**Full example**: `ST-2025-000001`, `ST-2025-000002`, ... `ST-2026-000001`

> **Why `ST-` for staff but nothing for students?** The prefix disambiguates staff codes at a glance in admin UIs, exports, and support tickets where both entity types may appear side-by-side. Student codes predate the convention and keep the shorter form for backwards compatibility of existing UI and seed data. New generators should default to including a meaningful prefix.

---

## Architecture

### Database Schema

Each generator has its own counter table with a **composite primary key** of `(campusId, year)`. This gives every campus an independent sequence so two campuses never share or collide on numbers.

```prisma
model StudentCodeSequence {
  campusId   String   @map("campus_id") @db.Uuid
  year       Int
  lastNumber Int      @default(0) @map("last_number")
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  campus Campus @relation(fields: [campusId], references: [id], onDelete: Restrict)

  @@id([campusId, year])
  @@map("student_code_sequence")
}

model StaffCodeSequence {
  campusId   String   @map("campus_id") @db.Uuid
  year       Int
  lastNumber Int      @default(0) @map("last_number")
  updatedAt  DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  campus Campus @relation(fields: [campusId], references: [id], onDelete: Restrict)

  @@id([campusId, year])
  @@map("staff_code_sequence")
}
```

Uniqueness of the generated code on the owning entity is enforced with a composite unique constraint:

```prisma
model Student {
  // ...
  studentCode String @map("student_code")
  campusId    String @map("campus_id") @db.Uuid
  // ...
  @@unique([campusId, studentCode])
}

model Staff {
  // ...
  staffCode String @map("staff_code")
  campusId  String @map("campus_id") @db.Uuid
  // ...
  @@unique([campusId, staffCode])
}
```

### Port (Application Layer)

Each generator is exposed as an abstract port so the application layer depends on an interface, not an infrastructure class. This keeps use cases testable without Prisma.

```typescript
// src/application/ports/student-code-generator.port.ts
export abstract class StudentCodeGeneratorPort {
  abstract generateNextCode(campusId: string): Promise<string>;
}

// src/application/ports/staff-code-generator.port.ts
export abstract class StaffCodeGeneratorPort {
  abstract generateNextCode(campusId: string): Promise<string>;
}
```

### Service (Infrastructure Layer)

Implementations live under `src/infra/persistence/prisma/services/`.

```typescript
// student-code-generator.service.ts
const MAX_SEQUENCE_NUMBER = 999999;

@Injectable()
export class StudentCodeGeneratorService extends StudentCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async generateNextCode(campusId: string): Promise<string> {
    const currentYear = new Date().getFullYear();

    const sequence = await this.prisma.studentCodeSequence.upsert({
      where: { campusId_year: { campusId, year: currentYear } },
      create: { campusId, year: currentYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    if (sequence.lastNumber > MAX_SEQUENCE_NUMBER) {
      throw new ConflictException(
        `Student code sequence exhausted for campus ${campusId} in year ${currentYear}.`,
      );
    }

    const paddedSequence = String(sequence.lastNumber).padStart(6, "0");
    return `${currentYear}-${paddedSequence}`;
  }
}
```

```typescript
// staff-code-generator.service.ts
const MAX_SEQUENCE_NUMBER = 999999;
const STAFF_CODE_PREFIX = "ST-";

@Injectable()
export class StaffCodeGeneratorService extends StaffCodeGeneratorPort {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async generateNextCode(campusId: string): Promise<string> {
    const currentYear = new Date().getFullYear();

    const sequence = await this.prisma.staffCodeSequence.upsert({
      where: { campusId_year: { campusId, year: currentYear } },
      create: { campusId, year: currentYear, lastNumber: 1 },
      update: { lastNumber: { increment: 1 } },
    });

    if (sequence.lastNumber > MAX_SEQUENCE_NUMBER) {
      throw new ConflictException(
        `Staff code sequence exhausted for campus ${campusId} in year ${currentYear}.`,
      );
    }

    const paddedSequence = String(sequence.lastNumber).padStart(6, "0");
    return `${STAFF_CODE_PREFIX}${currentYear}-${paddedSequence}`;
  }
}
```

### Module Wiring

Bind the port to the service inside the relevant NestJS module:

```typescript
providers: [
  { provide: StudentCodeGeneratorPort, useClass: StudentCodeGeneratorService },
  { provide: StaffCodeGeneratorPort, useClass: StaffCodeGeneratorService },
];
```

---

## Why a Counter Table?

### Problem: Race Conditions

Without atomic operations, concurrent requests can generate duplicate codes:

```
Request A: SELECT MAX(code) -> 000005
Request B: SELECT MAX(code) -> 000005   (same value!)
Request A: INSERT code = 000006
Request B: INSERT code = 000006         (DUPLICATE!)
```

### Solution: Atomic Upsert Scoped by Campus

The `upsert` with `increment` is atomic at the database level and keyed by `(campusId, year)`:

```typescript
await prisma.staffCodeSequence.upsert({
  where: { campusId_year: { campusId, year: currentYear } },
  create: { campusId, year: currentYear, lastNumber: 1 },
  update: { lastNumber: { increment: 1 } },
});
```

- First call of the year for a given campus: creates row with `lastNumber = 1`.
- Subsequent calls for the same campus + year: atomically increment `lastNumber`.
- Year change: a new row is created for the campus and the sequence resets to 1.
- Different campus on the same year: an independent row, independent sequence.

---

## Immutability

Generated codes are treated as identifying metadata for the lifetime of the entity. Once issued they must never change, otherwise historical records (attendance, invoices, exported reports, parent communications) lose their references.

Immutability is enforced at **four layers** so no single path can bypass it:

1. **Domain entity** — `staffCode`/`studentCode` is required on creation, has a read-only getter, and is excluded from the `UpdateXxxData` type:

   ```typescript
   export type UpdateStaffData = Partial<
     Omit<
       StaffProps,
       "id" | "campusId" | "staffCode" | "createdAt" | "updatedAt" | "isArchived"
     >
   >;
   ```

2. **Factory method** — format is validated on `Staff.create(...)` / `Student.create(...)` with a strict regex (`/^ST-\d{4}-\d{6}$/`, `/^\d{4}-\d{6}$/`).

3. **Mapper** — `toPrismaUpdate(...)` deliberately omits the code field and documents this with a comment. `toPrisma(...)` (create path) still includes it.

4. **Unit of Work port** — the `updateStaff`/`updateStudent` data shape on `UnitOfWorkPort` does not accept `staffCode`/`studentCode`, so transaction code cannot supply one even by accident.

> If you add a new code-generated field, replicate all four layers. Missing any one of them turns immutability into a gentleman's agreement.

---

## Usage in Use Case

```typescript
@Injectable()
export class CreateStaffUseCase {
  constructor(
    @Inject("STAFF_REPOSITORY")
    private readonly staffRepository: StaffRepository,
    private readonly unitOfWork: UnitOfWorkPort,
    private readonly staffCodeGenerator: StaffCodeGeneratorPort,
  ) {}

  async execute(input: CreateStaffInput): Promise<Staff> {
    // Generate the campus-scoped code first, then hand it to the entity.
    const staffCode = await this.staffCodeGenerator.generateNextCode(
      input.campusId,
    );

    const staff = Staff.create({
      campusId: input.campusId,
      staffCode,
      fullName: input.fullName,
      // ... other fields
    });

    return await this.unitOfWork.run(async (tx) => {
      return tx.createStaff({
        id: staff.id,
        campusId: staff.campusId,
        staffCode: staff.staffCode,
        // ... remaining fields
      });
    });
  }
}
```

Use cases depend on the **port**, not the service, so unit tests can substitute a mock generator without touching Prisma.

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| First entity of the year in a campus | Creates sequence row with `lastNumber = 1` |
| Year change (2025 -> 2026) | New row per campus, resets to `...-2026-000001` |
| Concurrent requests in same campus | Atomic increment prevents duplicates |
| Concurrent requests in different campuses | Independent rows, no contention |
| Creation fails after code was issued | Sequence number is consumed (gap is OK) |
| Sequence > 999,999 in one campus + year | Throws `ConflictException` |
| Attempt to update `staffCode`/`studentCode` | Blocked at the type level — `UpdateXxxData` does not include it |

---

## Seeding Data

When seeding entities, sync the sequence table afterward **per campus**:

```typescript
const currentYear = new Date().getFullYear();

for (const [campusId, highest] of highestSequenceByCampus) {
  await prisma.staffCodeSequence.upsert({
    where: { campusId_year: { campusId, year: currentYear } },
    create: { campusId, year: currentYear, lastNumber: highest },
    update: { lastNumber: highest },
  });
}
```

See `seeds/seed-students.ts` and `seeds/sync-sequence.ts` for examples.

---

## Creating Similar Generators

For a new entity that needs sequential, campus-scoped codes:

1. **Decide on a prefix.** Prefer a short, unambiguous prefix (like `ST-`) unless you have a strong reason not to. The student code is an exception preserved for historical reasons.
2. **Add the counter table** in `schema.prisma` with `@@id([campusId, year])` and a `campus` back-relation (`onDelete: Restrict`).
3. **Add the code field** on the owning entity with `@@unique([campusId, <codeField>])`.
4. **Create a port** in `src/application/ports/` exposing `generateNextCode(campusId: string): Promise<string>`.
5. **Create a service** in `src/infra/persistence/prisma/services/` that extends the port and performs the atomic `upsert` on the new counter table.
6. **Wire the port to the service** in the relevant module's `providers` (`{ provide: Port, useClass: Service }`).
7. **Inject the port** into the use case and call `generateNextCode(campusId)` before constructing the domain entity.
8. **Enforce immutability** in all four layers: entity type, factory validation, mapper's `toPrismaUpdate`, and Unit of Work port update shape.
9. **Add tests** for format, padding, concurrent increments (logic level), campus isolation, year rollover, and the `> 999,999` overflow case.
