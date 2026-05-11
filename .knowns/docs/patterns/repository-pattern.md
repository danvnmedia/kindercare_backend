---
title: Repository Pattern
description: Repository ports (application layer) and Prisma implementations (infra layer) with campus-scoped query patterns
createdAt: '2026-01-03T19:52:13.114Z'
updatedAt: '2026-05-05T17:39:49.992Z'
tags:
  - patterns
  - repository
  - persistence
  - campus
  - prisma
---

# Repository Pattern

> Data access. Port at `src/application/{module}/ports/{entity}.repository.ts`; implementation at `src/infra/persistence/prisma/repositories/prisma-{entity}.repository.ts`.

The repository is the **only** boundary between domain code and Prisma. Use cases depend on the port; the implementation is wired in the module via a string token.

## Port (Application Layer)

The port defines the contract using domain types only — no Prisma in the signature.

```typescript
import { Student } from "@/domain/user-management/entities/student.entity";
import { StandardRequest, PaginatedResult } from "@/core/modules/standard-response";

export interface StudentRepository {
  // Single-entity reads
  findById(id: string): Promise<Student | null>;
  findByIds(ids: string[]): Promise<Student[]>;

  // Global lookups (system tasks; rarely used in business logic)
  findByEmail(email: string): Promise<Student | null>;
  findByPhoneNumber(phoneNumber: string): Promise<Student | null>;

  // Campus-scoped lookups (preferred in business logic)
  findByEmailInCampus(campusId: string, email: string): Promise<Student | null>;
  findByPhoneNumberInCampus(campusId: string, phoneNumber: string): Promise<Student | null>;
  findByStudentCodeInCampus(campusId: string, studentCode: string): Promise<Student | null>;
  findByCampusId(campusId: string): Promise<Student[]>;

  // Paginated list (PrismaQueryService-driven)
  findAll(params: StandardRequest, scope?: Record<string, any>): Promise<PaginatedResult<Student>>;

  // Writes
  save(student: Student): Promise<Student>;
  update(student: Student): Promise<Student>;
  delete(id: string): Promise<void>;

  // Domain-specific methods
  assignGuardians(studentId: string, relations: Array<{ guardianId: string; relationshipId: string }>): Promise<void>;
  removeGuardians(studentId: string, guardianIds: string[]): Promise<void>;
  updateGuardianRelationship(studentId: string, guardianId: string, relationshipId: string): Promise<void>;
  getStudentGuardians(studentId: string): Promise<StudentGuardianInfo[]>;
}
```

The codebase mixes **`interface`** (most repositories) and **abstract class** (older ones). Either is acceptable; `interface` is preferred for new ports because it can't carry implementation by accident.

## Implementation (Prisma)

```typescript
@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,    // for findAll
  ) {}

  async findById(id: string): Promise<Student | null> {
    const row = await this.prisma.student.findUnique({
      where: { id },
      include: { guardians: { include: { guardian: true, guardianRelationship: true } } },
    });
    return row ? PrismaStudentMapper.toDomain(row) : null;
  }

  async save(student: Student): Promise<Student> {
    const created = await this.prisma.student.create({
      data: PrismaStudentMapper.toPrisma(student),
    });
    return PrismaStudentMapper.toDomain(created);
  }

  async update(student: Student): Promise<Student> {
    const updated = await this.prisma.student.update({
      where: { id: student.id },
      data: PrismaStudentMapper.toPrismaUpdate(student),
    });
    return PrismaStudentMapper.toDomain(updated);
  }

  async findAll(
    params: StandardRequest,
    scope?: Record<string, any>,
  ): Promise<PaginatedResult<Student>> {
    params.allowedFilterFields = ["studentCode", "fullName", "email", "phoneNumber", "gender", "isArchived", "dateOfBirth", "status"];
    params.allowedSortFields = ["createdAt", "updatedAt", "studentCode", "fullName", "dateOfBirth"];

    return this.queryService.executeQuery<Student>(
      this.prisma,
      "student",
      params,
      {
        include: { guardians: { include: { guardian: true, guardianRelationship: true } } },
        orderBy: { studentCode: "desc" },
        scope,                            // <-- system-enforced campus filter
      },
      PrismaStudentMapper,
    );
  }
}
```

## Campus-Scoped Query Patterns

### Pattern 1 — `*InCampus` lookups

Compound queries scoped by `campusId`. Use these for uniqueness checks in business logic.

```typescript
async findByEmailInCampus(campusId: string, email: string): Promise<Staff | null> {
  const row = await this.prisma.staff.findFirst({
    where: { campusId, email },
  });
  return row ? PrismaStaffMapper.toDomain(row) : null;
}
```

### Pattern 2 — Compound key lookups

Where Prisma supports compound unique constraints, use the typed lookup:

```typescript
async findBySchoolYearGradeAndName(
  campusId: string, schoolYearId: string, gradeLevelId: string, name: string,
): Promise<Class | null> {
  const row = await this.prisma.class.findUnique({
    where: { campusId_schoolYearId_gradeLevelId_name: { campusId, schoolYearId, gradeLevelId, name } },
  });
  return row ? PrismaClassMapper.toDomain(row) : null;
}
```

### Pattern 3 — Paginated queries with `scope`

The `scope` argument to `PrismaQueryService.executeQuery` is **system-enforced**: it merges into `where` last and overrides any user-supplied filter on the same field. This is the **only** correct way to scope a list endpoint by campus.

```typescript
return this.queryService.executeQuery<Post>(
  this.prisma, "post", params,
  { scope: { campusId, isDeleted: false } },
  PrismaPostMapper,
);
```

> Don't add `campusId` to `allowedFilterFields`. The user-supplied `?filter=...` query parameter is expected to be untrusted; `scope` is the trust boundary.

### Pattern 4 — Global vs campus-scoped entities

A few entities are global or hybrid:

| Entity | Scope |
|--------|-------|
| `User` | Global — one identity, multiple campus role assignments |
| `Permission` | Global — defines what actions exist |
| `Role` | Hybrid — `campusId: null` for system roles, UUID for campus-specific roles |
| `UserRole` | Hybrid — `campusId: null` for global assignment, UUID for campus-specific |

For these, the repository should not assume a campus filter. Use case logic decides whether to scope.

## What Repositories Must NOT Do

- **Validate access.** Whether the caller can read this campus is the guard's job; whether two entities are in the same campus is the use case's job.
- **Apply business rules.** No `if (entity.isArchived) throw ...` — that belongs on the entity or use case.
- **Dispatch events / call queues.** The repository is a pure persistence boundary.
- **Convert errors.** Let Prisma errors bubble up. Use cases interpret them.

## Repository ↔ UnitOfWork

When a use case must write to multiple tables atomically, **don't** chain repository calls. Use the Unit of Work, which exposes per-domain transaction operations:

```typescript
await this.unitOfWork.run(async (tx) => {
  const user = await tx.createUser({ clerkUid, isActive: true });
  await tx.createStaff({ id, campusId, userId: user.id, /* … */ });
  await tx.assignRoles(user.id, [{ roleId, campusId }]);
});
```

See [@doc/patterns/unit-of-work-pattern](patterns/unit-of-work-pattern). The repository's normal `save`/`update` methods stay non-transactional and are used outside the UoW path.

## Reference

| File | Notable |
|------|---------|
| `src/application/user-management/ports/student.repository.ts` | Mixed global + campus-scoped methods, guardian relationship operations |
| `src/infra/persistence/prisma/repositories/prisma-student.repository.ts` | Uses `PrismaQueryService.executeQuery` with `scope` |
| `src/infra/persistence/prisma/repositories/prisma-post.repository.ts` | Filters out soft-deleted posts in default queries |
| `src/infra/persistence/prisma/services/prisma-query.service.ts` | The query builder behind `findAll` (in `core/modules/standard-response/services/`) |
