---
title: Standard Response Pattern
description: The interceptor that wraps every successful response in a uniform envelope and auto-transforms domain entities into Response DTOs
createdAt: '2026-05-05T17:43:34.258Z'
updatedAt: '2026-05-05T17:43:34.258Z'
tags:
  - patterns
  - response
  - interceptor
  - dto
  - swagger
  - pagination
---

# Standard Response Pattern

> Located at `src/core/modules/standard-response/`. Globally registered in `main.ts`.

Every successful HTTP response in this codebase has the same shape:

```json
{
  "success": true,
  "message": "Student created successfully",
  "data": { /* … */ },
  "pagination": { /* present for paginated responses */ },
  "timestamp": "2025-12-16T03:30:00.000Z"
}
```

That is produced by **`StandardResponseInterceptor`**, configured per-route by the **`@StandardResponse(...)`** decorator. The interceptor also handles entity → DTO transformation, so controllers can just `return entity` and let the framework do the rest.

## Module Layout

```
src/core/modules/standard-response/
├── decorators/
│   ├── standard-response.decorator.ts     # @StandardResponse({ type, message, isPaginated, ... })
│   └── standard-request-param.decorator.ts # @StandardRequestParam()
├── dto/
│   ├── standard-request.dto.ts             # query DTO (limit, offset, sort, filter)
│   ├── standard-response.dto.ts            # response wrapper class + dynamic class factory
│   └── filter-schema.dto.ts                # FilterConditionDto (eq/in/like/...)
├── interceptors/
│   └── standard-response.interceptor.ts    # the wrapper
├── services/
│   ├── prisma-query.service.ts             # builds Prisma where/orderBy/skip/take
│   ├── query-validator.service.ts          # validates user filter/sort params
│   └── domain-to-dto.service.ts
└── standard-response.module.ts
```

`StandardResponseModule` is imported by every feature module that uses paginated lists, so `PrismaQueryService` and `QueryValidatorService` are available for repositories.

## Wiring

The interceptor is registered globally in `main.ts`:

```typescript
const standardResponseInterceptor = app.get(StandardResponseInterceptor);
app.useGlobalInterceptors(standardResponseInterceptor);
```

It only acts on routes that opt in via `@StandardResponse(...)`. Routes without the decorator pass through unchanged.

## `@StandardResponse(options)`

```typescript
@StandardResponse({
  type: StudentResponse,                    // or `null` for void responses, or a string for generic types
  message: "Student created successfully",  // default: "Operation completed successfully"
  isPaginated: false,                       // wrap as `{ data, pagination }`
  isArray: false,                           // mark `data` as an array of `type`
  defaultLimit: 20,                          // pagination default
  maxLimit: 50,                              // pagination cap
  allowedSortFields: ["createdAt", "fullName"],     // for paginated lists
  allowedFilterFields: ["fullName", "email", "isArchived"],
})
```

The decorator stamps metadata (`STANDARD_RESPONSE_KEY`) and **also** applies `@ApiResponse` and `@ApiQuery` to keep Swagger in sync. That means setting `allowedSortFields`/`allowedFilterFields` documents them automatically.

The dynamic `StandardResponseWith<T>` class is generated at decoration time so OpenAPI knows the exact response shape (including the typed `data` property).

## How the Interceptor Processes a Response

The flow on success is:

1. **Read metadata** for the handler. If no `@StandardResponse`, pass through.
2. **Validate query params** if any — uses `QueryValidatorService` against `allowedSortFields`/`allowedFilterFields`/`maxLimit`. Invalid params throw `BadRequestException` (400).
3. **Sanitise query** and stash a `StandardRequest` on `request.standard_request` for `@StandardRequestParam()` to read.
4. **Process the return value** to handle domain types:
   - `ValueObject<T>` → `vo.toPlain()`
   - `Entity<Props>` → flatten `_id` + `props`, also include public getters that aren't in `props`
   - `Date` → preserved
   - `Array` / regular `object` → recurse
5. **Run `class-transformer`** with `excludeExtraneousValues: true` if `type` is a class. This is what enforces `@Expose()` on Response DTOs.
6. **Convert `Date` → ISO string** in nested values.
7. **Wrap the result**:
   - Paginated input (`{ data, pagination }`) → `{ success, message, data, pagination, timestamp }`
   - Array → `{ success, message, data, timestamp }`
   - Single value → `{ success, message, data, timestamp }`

Errors bypass the interceptor and follow NestJS's default error handling (no global filter — see [@doc/patterns/exception-pattern](patterns/exception-pattern)).

## Paginated Responses

Use cases that return `PaginatedResult<T>`:

```typescript
return this.queryService.executeQuery<Student>(this.prisma, "student", params, { scope: { campusId } }, PrismaStudentMapper);
// returns { data: Student[], pagination: { count, limit, offset, totalPages, currentPage, hasNext, hasPrev } }
```

Pair with `@StandardResponse({ type: StudentResponse, isPaginated: true, ... })` and the interceptor auto-detects the shape. The `pagination` block is always:

```ts
{
  count: number;       // total matching items
  limit: number;
  offset: number;
  totalPages: number;
  currentPage: number; // 1-based
  hasNext: boolean;
  hasPrev: boolean;
}
```

## `@StandardRequestParam()`

Binds the validated, sanitised query DTO from `request.standard_request` to a controller param.

```typescript
async findAll(
  @CampusContext() campusId: string,
  @StandardRequestParam() params: StandardRequestDto,
) {
  return this.getAllStudentsUseCase.execute({ campusId, params });
}
```

The DTO already has `limit`, `offset`, `sort`, `filter` resolved into the typed `filterInfo`/`sortInfo`. Use cases pass it straight to repositories.

## Pagination & Filter Grammar

See [@doc/guides/pagination-and-filtering](guides/pagination-and-filtering) for the full operator list. Key points:

- `?sort=-createdAt,fullName` — `-` prefix = descending; comma = secondary keys.
- `?filter={"status":"ACTIVE","fullName":{"like":"Anh"}}` — JSON-encoded operator map.
- Operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `not_in`, `between`.

## Domain Entity → DTO Auto-Conversion

The interceptor's most useful feature is that you can return a domain entity and the response is a DTO. Mechanically:

```typescript
// Controller
async findOne(@Param("id") id: string): Promise<Student> {  // ← domain entity
  return this.getStudentByIdUseCase.execute(id);
}
```

```json
// Wire output (Student.toPlain merged with @Expose-d StudentResponse)
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { "id": "…", "campusId": "…", "fullName": "…", … },
  "timestamp": "…"
}
```

### Visibility rules

- Fields without `@Expose()` on the Response DTO are **stripped** by `excludeExtraneousValues: true`.
- The interceptor includes **public getters** that aren't in `props` (e.g. computed values like a hypothetical `priceUsd`). Use this sparingly.
- Domain `Date` values are converted to ISO strings.
- Nested entities and value objects recurse — no manual unwrapping needed.

## When NOT to Use the Interceptor

- **Streaming responses** (file downloads, server-sent events) — return a raw `StreamableFile` and don't apply `@StandardResponse`.
- **Webhook endpoints** that must echo a specific shape — same.
- **Anything that needs to omit the wrapper** — explicitly skip `@StandardResponse`.

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Forgetting `@Expose()` on a Response DTO field | Field is missing in the output |
| Returning a manually-constructed `{ data, pagination }` without `isPaginated: true` | Wrapper still applies, but Swagger shape is wrong |
| Passing `campusId` in `allowedFilterFields` | User can override the campus scope; use `scope` in the repository instead |
| Setting `type` to an interface | `class-transformer` can't transform interfaces — pass a class |
| Mutating the entity after returning | Interceptor reads it post-return; mutate inside the handler |

## Reference

| File | Notes |
|------|-------|
| `src/core/modules/standard-response/decorators/standard-response.decorator.ts` | The decorator |
| `src/core/modules/standard-response/interceptors/standard-response.interceptor.ts` | The transformation pipeline |
| `src/core/modules/standard-response/dto/standard-response.dto.ts` | Wrapper class + dynamic class factory |
| `src/core/modules/standard-response/services/prisma-query.service.ts` | Filter/sort/pagination → Prisma |
| `src/core/modules/standard-response/services/query-validator.service.ts` | Validates user-supplied query params |
