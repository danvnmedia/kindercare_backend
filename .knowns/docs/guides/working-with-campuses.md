---
title: Working with Campuses
description: 'Practical guide for adding campus-aware features: extracting context, validating ownership, scoping queries, and preventing cross-campus leakage'
createdAt: '2026-01-11T05:37:53.394Z'
updatedAt: '2026-05-05T17:39:02.017Z'
tags:
  - guide
  - campus
  - multi-campus
  - how-to
---

# Working with Campuses

> Practical patterns for any feature that must respect campus isolation. The architecture is documented in [@doc/architecture/multi-campus-architecture](architecture/multi-campus-architecture); this guide focuses on day-to-day code.

## Quick Reference

| Task | Pattern |
|------|---------|
| Get campus ID in controller | `@CampusContext() campusId: string` (with `@RequireCampusAccess()`) |
| Require campus access | `@RequireCampusAccess()` (class or method) |
| Pass to use case | First field of the input interface: `campusId: string` |
| Filter queries | Pass `scope: { campusId }` to `PrismaQueryService.executeQuery` — system-enforced |
| Check campus ownership | `if (entity.campusId !== input.campusId) throw new BadRequestException(...)` |
| Cross-entity validation | Validate every related entity's `campusId === input.campusId` |

## Controller Patterns

### Requiring campus access on the whole controller

```typescript
@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StudentController {
  @Post()
  @RequireCampusAccess()                                // CampusGuard runs here
  @ApiHeader({ name: "x-campus-id", required: true })
  @StandardResponse({ type: StudentResponse, message: "Student created successfully" })
  async create(
    @CampusContext() campusId: string,                  // validated by CampusGuard
    @Body() dto: CreateStudentRequest,
  ) {
    return this.createStudentUseCase.execute({ ...dto, campusId });
  }
}
```

### Decorator options

```typescript
@RequireCampusAccess()                                  // all defaults: required, active, user-access checked, admin bypass
@RequireCampusAccess({ required: false })               // header is optional (rarely needed)
@RequireCampusAccess({ requireActive: false })          // admin un-archive endpoints
@RequireCampusAccess({ checkUserAccess: false })        // public per-campus info
@RequireCampusAccess({ allowGlobalAdmin: false })       // even system roles must have explicit campus access
```

### Optional campus context

For endpoints that work with or without a campus (rare — usually report exports for global admins):

```typescript
@Get("reports")
@OptionalCampusAccess()
async getReports(@CampusContext() campusId: string | null) {
  return campusId
    ? this.reportService.findByCampus(campusId)
    : this.reportService.findAll();
}
```

## Use Case Patterns

### Input interface

`campusId` is **required** and is the first field by convention.

```typescript
export interface CreateStudentInput {
  campusId: string;                       // always first
  fullName: string;
  email?: string;
  phoneNumber?: string;
  guardianIds?: string[];
}
```

### Cross-campus validation

When a use case touches multiple entities, validate that **all of them** belong to the same campus.

```typescript
async execute(input: EnrollStudentInput): Promise<Enrollment> {
  const classEntity = await this.classRepository.findById(input.classId);
  if (!classEntity) throw new NotFoundException("Class not found");
  if (classEntity.campusId !== input.campusId) {
    throw new BadRequestException("Class does not belong to this campus");
  }

  const student = await this.studentRepository.findById(input.studentId);
  if (!student) throw new NotFoundException("Student not found");
  if (student.campusId !== input.campusId) {
    throw new BadRequestException("Cannot enroll student from a different campus");
  }
  // …
}
```

This protection is **independent of the guard**. The guard only checks the user's access to the campus header; the use case must still verify the entities themselves.

### Campus-scoped uniqueness checks

Always use the `*InCampus` repository methods, never the global ones.

```typescript
private async checkStaffUniqueness(input: CreateStaffInput): Promise<void> {
  const existingByEmail = await this.staffRepository.findByEmailInCampus(
    input.campusId, input.email,
  );
  if (existingByEmail) {
    throw new ConflictException(
      `Staff with email ${input.email} already exists in this campus`,
    );
  }

  const existingByPhone = await this.staffRepository.findByPhoneNumberInCampus(
    input.campusId, input.phoneNumber,
  );
  if (existingByPhone) {
    throw new ConflictException(
      `Staff with phone number ${input.phoneNumber} already exists in this campus`,
    );
  }
}
```

The non-campus-scoped methods (`findByEmail` without `InCampus`) exist for system-level checks (e.g. cross-campus reporting) and should not be used inside per-campus business logic.

## Repository Patterns

### Port definition

Define both kinds of method:

```typescript
export interface StaffRepository {
  // Global lookups (rarely used in business logic)
  findById(id: string): Promise<Staff | null>;
  findByEmail(email: string): Promise<Staff | null>;

  // Campus-scoped lookups (preferred in business logic)
  findByEmailInCampus(campusId: string, email: string): Promise<Staff | null>;
  findByPhoneNumberInCampus(campusId: string, phoneNumber: string): Promise<Staff | null>;
  findByCampusId(campusId: string): Promise<Staff[]>;
  findAll(params: StandardRequest, scope?: Record<string, any>): Promise<PaginatedResult<Staff>>;

  save(staff: Staff): Promise<Staff>;
  update(staff: Staff): Promise<Staff>;
  delete(id: string): Promise<void>;
}
```

### Prisma implementation — system-enforced campus scope

Use `PrismaQueryService.executeQuery` with the `scope` option. `scope` is **applied last** in the `where` clause and **always wins** — the user's `filter` query parameters cannot override it.

```typescript
async findAll(
  params: StandardRequest,
  scope?: Record<string, any>,
): Promise<PaginatedResult<Student>> {
  params.allowedFilterFields = ["studentCode", "fullName", "email", "phoneNumber", "gender", "isArchived"];
  params.allowedSortFields = ["createdAt", "studentCode", "fullName", "dateOfBirth"];

  return this.queryService.executeQuery<Student>(
    this.prisma,
    "student",
    params,
    {
      include: { guardians: { include: { guardian: true, guardianRelationship: true } } },
      orderBy: { studentCode: "desc" },
      scope,                                            // { campusId } — system-enforced
    },
    PrismaStudentMapper,
  );
}
```

In the controller / use case, pass `scope: { campusId }`:

```typescript
async execute(input: GetAllStudentsInput) {
  return this.studentRepository.findAll(input.params, { campusId: input.campusId });
}
```

> **Don't** add `campusId` to `allowedFilterFields` and rely on the user supplying it in the `filter` query string. That makes the campus filter user-controllable. Always pass via `scope`.

## Entity Patterns

### Validate `campusId` in the factory

```typescript
public static create(props, id?): Student {
  if (!props.campusId) throw new Error("Campus ID is required for student.");
  // …
}
```

### Make `campusId` immutable

Exclude it from the update type:

```typescript
export type UpdateStudentData = Partial<
  Omit<StudentProps, "id" | "campusId" | "createdAt" | "updatedAt" | "isArchived">
>;
```

And omit it in the mapper:

```typescript
static toPrismaUpdate(s: Student): Prisma.StudentUpdateInput {
  return {
    fullName: s.fullName,
    // campusId intentionally omitted — immutable
    updatedAt: s.updatedAt,
  };
}
```

If the entity needs to "move" between campuses, that should be a domain operation with a new code generation — design it explicitly, don't make `campusId` mutable.

## Swagger Documentation

Document the campus header on every campus-scoped endpoint:

```typescript
@ApiHeader({
  name: "x-campus-id",
  description: "Campus ID to scope the request",
  required: true,
})
```

The OpenAPI doc bootstrap in `main.ts` already declares `X-Campus-Id` as a security scheme, but per-endpoint headers help frontend/Swagger UI discoverability.

## Testing Patterns

### Unit tests with mock repositories

```typescript
import { createMockStudentRepository, DEFAULT_CAMPUS_ID_A } from "@/test-utils";
import { createStudent } from "@/test-utils/entity-factories";

const studentRepo = createMockStudentRepository();
studentRepo.findById.mockResolvedValue(createStudent({ campusId: DEFAULT_CAMPUS_ID_A }));

const useCase = new ArchiveStudentUseCase(studentRepo, /* … */);
await useCase.execute("student-id", DEFAULT_CAMPUS_ID_A);
```

### Cross-campus prevention tests

Every campus-scoped use case should have a test that:

1. Creates an entity in `DEFAULT_CAMPUS_ID_A`.
2. Calls the use case with `DEFAULT_CAMPUS_ID_B`.
3. Asserts a `BadRequestException` (or `NotFoundException`, depending on the contract).

See `src/application/campus/use-cases/campus-isolation.integration.spec.ts` and `src/application/rbac/use-cases/rbac-campus-scoping.integration.spec.ts` for the canonical patterns.

## Common Mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Reading `campusId` from the request body | User can target any campus | Use `@CampusContext()`, ignore body field, or override |
| Forgetting `@RequireCampusAccess()` on a campus-scoped route | No campus validation | Add the decorator (and the `@ApiHeader` doc) |
| Putting `campusId` in `allowedFilterFields` instead of `scope` | User can drop the filter | Use `scope: { campusId }` |
| Not validating cross-entity campus | Cross-campus enrollment / assignment becomes possible | Validate every related entity in the use case |
| Allowing `campusId` updates | Data drifts between campuses | Exclude from `UpdateXxxData` and the mapper's `toPrismaUpdate` |
| Missing `findXxxInCampus` repository methods | Forced to global lookup, leading to cross-campus collisions on uniqueness | Add the campus-scoped variants to the port |
