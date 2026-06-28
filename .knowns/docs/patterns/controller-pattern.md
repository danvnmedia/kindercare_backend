---
title: Controller Pattern
description: 'HTTP controllers: routing, guards, decorators, swagger, and the StandardResponse interceptor'
createdAt: '2026-01-03T19:52:09.955Z'
updatedAt: '2026-05-05T17:41:43.865Z'
tags:
  - patterns
  - controller
  - http
  - swagger
  - campus
---

# Controller Pattern

> HTTP controllers. Located at `src/infra/http/controllers/{module}/{entity}.controller.ts`.

A controller is a thin routing layer that:

1. Authenticates and authorizes via guards.
2. Validates the input via DTOs (the global `ValidationPipe` does this).
3. Extracts validated context with parameter decorators.
4. Delegates to a use case.
5. Returns the domain result; `StandardResponseInterceptor` handles serialization.

Controllers should never run business logic.

## Class Decorators

```typescript
@Controller("students")                       // route prefix → /api/students
@ApiTags("Students")                           // Swagger group
@ApiBearerAuth("JWT")                          // requires bearer token in Swagger UI
@UseGuards(ClerkAuthGuard)                     // class-level: every route requires auth
export class StudentController { … }
```

`api` is a global prefix (set in `main.ts`); the `@Controller` value is the per-controller path.

## Method Decorators

### HTTP verbs

`@Post()`, `@Get(":id")`, `@Patch(":id")`, `@Delete(":id")`. Stick to REST conventions:

| Verb | Path | Use case |
|------|------|----------|
| `POST` | `/` | Create |
| `GET` | `/` | List (paginated) |
| `GET` | `/:id` | Single read |
| `PATCH` | `/:id` | Partial update |
| `DELETE` | `/:id` | Soft archive (default) |
| `PATCH` | `/:id/restore` | Un-archive |
| `POST` | `/:id/{action}` | Domain action (e.g. `/:id/transition`, `/:id/pin`) |

Hard deletes go in a separate `DangerXxxController` so they can be governed by stricter permissions.

### Custom decorators

| Decorator | Purpose |
|-----------|---------|
| `@RequireCampusAccess()` | Apply `CampusGuard` and validate `X-Campus-Id` (see [@doc/patterns/decorators-pattern](patterns/decorators-pattern)) |
| `@StandardResponse({ ... })` | Configure the response interceptor + Swagger metadata |
| `@StandardRequestParam()` | Bind the paginated query DTO with validation |
| `@Permissions("student.create")` + `@UseGuards(PermissionsGuard)` | Permission gate |
| `@Roles("Admin")` + `@UseGuards(RolesGuard)` | Role gate |
| `@Public()` | Skip authentication |

### Parameter decorators

| Decorator | Returns |
|-----------|---------|
| `@CampusContext() campusId: string` | Validated campus ID (after `CampusGuard`) |
| `@CurrentUser() user: User` | Cached domain `User` entity (after `getUser()` ran) |
| `@Param("id", ParseUUIDPipe) id: string` | Route param with UUID validation |
| `@Body() dto: CreateXxxRequest` | Validated request body |
| `@Query() query: SomeDto` / `@StandardRequestParam() params` | Validated query string |

## Canonical Controller

```typescript
@Controller("students")
@ApiTags("Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StudentController {
  constructor(
    private readonly createStudentUseCase: CreateStudentUseCase,
    private readonly getAllStudentsUseCase: GetAllStudentsUseCase,
    private readonly getStudentByIdUseCase: GetStudentByIdUseCase,
    private readonly updateStudentUseCase: UpdateStudentUseCase,
    private readonly archiveStudentUseCase: ArchiveStudentUseCase,
    private readonly restoreStudentUseCase: RestoreStudentUseCase,
  ) {}

  @Post()
  @RequireCampusAccess()
  @ApiOperation({ summary: "Create a new student" })
  @ApiHeader({ name: "x-campus-id", description: "Campus ID to scope the request", required: true })
  @StandardResponse({ type: StudentResponse, message: "Student created successfully" })
  async create(
    @CampusContext() campusId: string,
    @Body() dto: CreateStudentRequest,
  ) {
    return this.createStudentUseCase.execute({ ...dto, campusId, gender: dto.gender as Gender });
  }

  @Get()
  @RequireCampusAccess()
  @ApiOperation({ summary: "List students in a campus" })
  @ApiHeader({ name: "x-campus-id", required: true })
  @StandardResponse({
    type: StudentResponse,
    isPaginated: true,
    message: "Students retrieved successfully",
    allowedSortFields: ["createdAt", "studentCode", "fullName", "dateOfBirth"],
    allowedFilterFields: ["fullName", "email", "phoneNumber", "gender", "isArchived"],
  })
  async findAll(
    @CampusContext() campusId: string,
    @StandardRequestParam() query: StandardRequestDto,
  ) {
    return this.getAllStudentsUseCase.execute({ campusId, params: query });
  }

  @Get(":id")
  @RequireCampusAccess()
  @ApiOperation({ summary: "Get a student by ID" })
  @ApiParam({ name: "id", format: "uuid" })
  @StandardResponse({ type: StudentResponse })
  async findOne(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.getStudentByIdUseCase.execute(id, campusId);
  }

  @Patch(":id")
  @RequireCampusAccess()
  @ApiOperation({ summary: "Update a student" })
  @StandardResponse({ type: StudentResponse, message: "Student updated successfully" })
  async update(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentRequest,
  ) {
    return this.updateStudentUseCase.execute(id, { ...dto, campusId });
  }

  @Delete(":id")
  @RequireCampusAccess()
  @ApiOperation({ summary: "Archive (soft delete) a student" })
  @StandardResponse({ type: StudentResponse, message: "Student archived successfully" })
  async archive(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.archiveStudentUseCase.execute(id, campusId);
  }

  @Patch(":id/restore")
  @RequireCampusAccess()
  @ApiOperation({ summary: "Restore an archived student" })
  @StandardResponse({ type: StudentResponse, message: "Student restored successfully" })
  async restore(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.restoreStudentUseCase.execute(id, campusId);
  }
}
```

## Hard-Delete (`Danger`) Controller

Hard deletes live separately so they can be governed by stricter permissions and stricter rate-limiting policies:

```typescript
@Controller("danger/students")
@ApiTags("Danger - Students")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard, PermissionsGuard)
@Permissions("student.delete")           // requires explicit hard-delete permission
export class DangerStudentController {
  constructor(private readonly deleteStudentUseCase: DeleteStudentUseCase) {}

  @Delete(":id")
  @RequireCampusAccess()
  @ApiOperation({
    summary: "PERMANENTLY DELETE a student",
    description: "This deletes the student row and all dependent rows. Use the soft-archive endpoint unless the user has explicitly requested permanent removal.",
  })
  @StandardResponse({ type: null })
  async destroy(
    @CampusContext() campusId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    await this.deleteStudentUseCase.execute(id, campusId);
    return null;
  }
}
```

## Pagination Endpoints

Use `@StandardRequestParam()` to bind the query DTO and `@StandardResponse({ isPaginated: true, ... })` to wire pagination + Swagger:

```typescript
@Get()
@StandardResponse({
  type: PostResponse,
  isPaginated: true,
  allowedSortFields: ["createdAt", "title", "status", "isPinned"],
  allowedFilterFields: ["title", "status", "audiences", "isPinned"],
})
async findMany(
  @CampusContext() campusId: string,
  @StandardRequestParam() params: StandardRequest,
) {
  return this.listPostsUseCase.execute(campusId, params);
}
```

The interceptor wraps the `PaginatedResult<T>` return into `{ success, message, data, pagination, timestamp }`. See [@doc/patterns/standard-response-pattern](patterns/standard-response-pattern).

## Best Practices

1. **Inject use cases, not repositories.** A controller importing `@Inject('STUDENT_REPOSITORY')` is a smell — the use case should encapsulate the policy.
2. **Always pair `@CampusContext()` with `@RequireCampusAccess()`.** Otherwise the value isn't validated.
3. **Always set `@StandardResponse({ type: ... })`.** Even for `void` returns, set `type: null` to keep the wrapper consistent.
4. **Document the campus header.** `@ApiHeader({ name: "x-campus-id", required: true })` per route, even though `main.ts` declares the security scheme globally.
5. **Use `ParseUUIDPipe` on UUID params.** Cheap defence against type-confusion bugs.
6. **Name actions in URLs.** Prefer `/:id/transition`, `/:id/pin`, `/:id/restore` over generic `PATCH` overloads when the semantics are different.
7. **Don't read context from `request` directly.** Use `@CampusContext()`, `@CurrentUser()`, and (rarely) inject `RequestContext`.

## Reference

| File | Notable |
|------|---------|
| `src/infra/http/controllers/user-management/student.controller.ts` | Standard CRUD + relationship endpoints |
| `src/infra/http/controllers/post.controller.ts` | Many domain actions (`/transition`, `/pin`, `/heart`, `/comments`) |
| `src/infra/http/controllers/danger/danger-student.controller.ts` | Hard-delete pattern |
| `src/infra/http/controllers/auth/auth.controller.ts` | Read from `RequestContext` directly |
