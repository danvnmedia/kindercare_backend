---
title: Mapper Pattern
description: Prisma ↔ Domain conversion. Includes the critical UncheckedUpdateInput escape hatch for FK fields.
createdAt: '2026-01-03T19:52:08.384Z'
updatedAt: '2026-05-31T02:12:58.918Z'
tags:
  - patterns
  - prisma
  - mapper
  - persistence
---

# Mapper Pattern

> Prisma ↔ Domain conversion. Located at `src/infra/persistence/prisma/mapper/prisma-{entity}.mapper.ts`.

Mappers are the only place where Prisma types touch the domain. Repositories use them; nothing else should. Keep them as static-method classes with no DI — they have no dependencies and are easy to test in isolation.

## Required Methods

### 1. `toDomain(prismaEntityWithRelations) → Entity`

Used by queries that include relations.

```typescript
type PrismaStudentWithRelations = PrismaStudent & {
  guardians?: Array<PrismaGuardianStudent & {
    guardian: PrismaGuardian;
    guardianRelationship: PrismaGuardianRelationship;
  }>;
};

static toDomain(prismaStudent: PrismaStudentWithRelations): Student {
  return Student.create({
    campusId: prismaStudent.campusId,
    studentCode: prismaStudent.studentCode,
    fullName: prismaStudent.fullName,
    email: prismaStudent.email,
    // … cast enums, preserve nulls
    gender: prismaStudent.gender as Gender | null,
    status: prismaStudent.status as StudentStatus,
    isArchived: prismaStudent.isArchived,
    createdAt: prismaStudent.createdAt,
    updatedAt: prismaStudent.updatedAt,
  }, prismaStudent.id);
}
```

### 2. `toDomainSimple(prismaEntity) → Entity`

Identical mapping but typed against the bare Prisma model — no relations. Use this when looping over collections inside other mappers to prevent infinite types and circular references.

### 3. `toPrisma(entity) → Prisma.XxxUncheckedCreateInput`

Used by `repository.save(entity)`. Always uses **`UncheckedCreateInput`** so foreign-key columns can be assigned directly (`campusId: student.campusId`) instead of using relation `connect`.

```typescript
static toPrisma(student: Student): Prisma.StudentUncheckedCreateInput {
  return {
    id: student.id,
    campusId: student.campusId,
    studentCode: student.studentCode,
    // …
  };
}
```

### 4. `toPrismaUpdate(entity) → Prisma.XxxUpdateInput | Prisma.XxxUncheckedUpdateInput`

Used by `repository.update(entity)`. **Choosing the right input type here is a known footgun** — see the next section.

```typescript
static toPrismaUpdate(student: Student): Prisma.StudentUpdateInput {
  // campusId and studentCode are intentionally omitted — both immutable.
  return {
    fullName: student.fullName,
    email: student.email,
    // …
    updatedAt: student.updatedAt,
  };
}
```

### 5. `toDomainArray(prismaEntities[]) → Entity[]`

Trivial helper, but standardising it makes call sites easier to read.

## ⚠️ `UpdateInput` vs `UncheckedUpdateInput`

> When a `toPrismaUpdate()` mapper needs to update **foreign key fields** (`gradeLevelId`, `campusId`, `staffTypeId`, etc.), the return type **must be `Prisma.XxxUncheckedUpdateInput`**, not `Prisma.XxxUpdateInput`.

The regular `XxxUpdateInput` type uses **relation objects**:

```typescript
// Wrong — silently does nothing
static toPrismaUpdate(c: Class): Prisma.ClassUpdateInput {
  return { gradeLevelId: c.gradeLevelId };  // ⚠️ ignored at runtime
}
```

Prisma will quietly ignore raw FK fields on `XxxUpdateInput` and only honour `gradeLevel: { connect: { id } }`. The fix:

```typescript
static toPrismaUpdate(c: Class): Prisma.ClassUncheckedUpdateInput {
  return {
    name: c.name,
    description: c.description,
    gradeLevelId: c.gradeLevelId,    // ✅ honoured
    schoolYearId: c.schoolYearId,    // ✅ honoured
    updatedAt: c.updatedAt,
  };
}
```

See `prisma-class.mapper.ts` for the canonical example. If your update only touches non-FK columns, `XxxUpdateInput` is fine. The moment you add an FK, switch to `XxxUncheckedUpdateInput`.

## Immutability — Omit, Don't Send `undefined`

For fields that must never change (`id`, `campusId`, generated codes such as `studentCode`/`staffCode`, `createdAt`), omit them from update shapes entirely. Do not send `undefined`; Prisma treats `undefined` as skip, but the type system will not catch accidental inclusion.

```typescript
// Good — code field cannot be sent at all
static toPrismaUpdate(s: Staff): Prisma.StaffUpdateInput {
  return {
    fullName: s.fullName,
    // staffCode is intentionally omitted — immutable after creation
    updatedAt: s.updatedAt,
  };
}
```

For generated codes, enforce immutability at all four layers:

1. Domain entity: require the code on creation, expose a read-only getter, and omit it from `UpdateXxxData`.
2. Factory method: validate the code format in `create(...)` so invalid data cannot be reconstituted silently.
3. Prisma mapper: include the code in `toDomain` and `toPrisma`, but omit it from `toPrismaUpdate` with a short explanatory comment.
4. Unit of Work port: update operation input types must not accept the generated code field.

Skipping any layer leaves a bypass path. For example, if the entity update type omits the field but the mapper writes `staff.staffCode` in `toPrismaUpdate`, repository updates can still mutate the code.

Reference examples: `prisma-staff.mapper.ts` for `toPrismaUpdate` omission and `UnitOfWorkPort.updateStaff` / `UnitOfWorkPort.updateStudent` for update-input exclusion.
## Enum Casting

Prisma enums are stored as strings. Cast them explicitly:

```typescript
gender: prismaStudent.gender as Gender | null,
status: prismaStudent.status as StudentStatus,
```

Don't do this for fields that are already typed by your Prisma schema (it would be redundant). Do it for `String` columns that the domain treats as enums (`Student.status`, `Post.status`, etc.).

## Nullability

Pass nulls through unchanged. Don't coerce `null` to `undefined` in the mapper — that erases meaning. Prisma's `String?` columns map to `string | null` in TypeScript and the domain entity should expose the same type:

```typescript
email: prismaStudent.email,             // string | null — preserved
phoneNumber: prismaStudent.phoneNumber, // string | null — preserved
```

## Type Aliases at the Top of the File

```typescript
import {
  Student as PrismaStudent,
  Class as PrismaClass,
  Guardian as PrismaGuardian,
  GuardianRelationship as PrismaGuardianRelationship,
  GuardianStudent as PrismaGuardianStudent,
  Prisma,
} from "@prisma/client";

type PrismaStudentWithRelations = PrismaStudent & {
  guardians?: Array<PrismaGuardianStudent & {
    guardian: PrismaGuardian;
    guardianRelationship: PrismaGuardianRelationship;
  }>;
};
```

The `as PrismaXxx` aliasing keeps domain `Student` and Prisma `Student` distinguishable in long files.

## Best Practices

1. **`UncheckedUpdateInput` for FK columns.** This is the single biggest source of "the update silently did nothing" bugs.
2. **Omit immutable fields from the update shape.** Type-level guarantee.
3. **Static methods only.** Mappers have no DI and no instance state.
4. **One mapper file per Prisma model.** Don't share mappers across entities.
5. **Pass `null` through.** Never silently convert to `undefined`.
6. **Don't put domain logic in the mapper.** If you find yourself running a calculation, the work belongs on the entity.

## Reference Mappers

| File | Notable handling |
|------|------------------|
| `prisma-student.mapper.ts` | Includes guardians via `GuardianStudent` |
| `prisma-staff.mapper.ts` | Code immutability, optional `staffTypeId`/`userId` |
| `prisma-class.mapper.ts` | Uses `UncheckedUpdateInput` for FK fields (`gradeLevelId`, `schoolYearId`) |
| `prisma-post.mapper.ts` | Maps `Json` content directly, joins `audiences`/`attachments`/`categories` |
| `prisma-user.mapper.ts` | Maps `roleAssignments` (UserRole join with campus context) |
