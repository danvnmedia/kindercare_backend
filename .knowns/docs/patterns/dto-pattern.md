---
title: DTO Pattern
description: 'Request and response DTOs at the HTTP layer: class-validator on inputs, class-transformer @Expose on outputs, custom validators'
createdAt: '2026-01-03T19:52:14.788Z'
updatedAt: '2026-05-05T17:40:41.598Z'
tags:
  - patterns
  - dto
  - validation
  - http
  - swagger
---

# DTO Pattern

> Data transfer objects between the wire and the application layer. Located at `src/infra/http/dtos/{module}/`.

DTOs are the **typed contract** between the frontend and the backend. They live exclusively in the HTTP layer — neither use cases nor domain code import them.

| Direction | Type | Decorators |
|-----------|------|------------|
| Inbound (request) | `Xxx Request` | `class-validator` + `@ApiProperty` |
| Outbound (response) | `Xxx Response` | `class-transformer` (`@Expose`, `@Type`) + `@ApiProperty` |

Inbound DTOs go through the global `ValidationPipe` (configured in `main.ts` with `whitelist: true, forbidNonWhitelisted: true, transform: true`). Outbound DTOs are produced by `StandardResponseInterceptor` via `plainToInstance(...)` with `excludeExtraneousValues: true`.

## Request DTOs

### Conventions

- File: `{action}-{entity}.request.ts`. Naming aligns with use case names (e.g. `create-student.request.ts`).
- Validate strictly. The use case can trust everything in a Request DTO.
- Use **custom validators** from `@/core/validators` for non-trivial formats (E.164 phone, age limits, UTC dates).
- Provide a meaningful `@ApiProperty({ description, example })` on every field.

### Example

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Gender, StudentStatus } from "@/domain/user-management";
import { IsE164Phone, IsChildDateOfBirth, TransformToUTCDate } from "@/core/validators";

class GuardianLinkInput {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  guardianId: string;

  @ApiProperty({ format: "uuid", description: "GuardianRelationship row in the same campus" })
  @IsUUID()
  relationshipId: string;
}

export class CreateStudentRequest {
  @ApiProperty({ example: "Nguyễn Minh Anh", minLength: 2, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ required: false, example: "Anh" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @ApiProperty({ required: false, example: "+84901234567" })
  @IsOptional()
  @IsString()
  @IsE164Phone()
  phoneNumber?: string;

  @ApiProperty({ required: false, example: "child@example.com" })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false, example: "2020-05-15T00:00:00.000Z" })
  @IsOptional()
  @TransformToUTCDate()
  @IsChildDateOfBirth({ minAge: 0, maxAge: 18 })
  dateOfBirth?: Date;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ enum: StudentStatus, required: false, default: StudentStatus.WAITING })
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @ApiProperty({ type: [GuardianLinkInput], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GuardianLinkInput)
  guardians?: GuardianLinkInput[];
}
```

### Common decorators

| Decorator | Use |
|-----------|-----|
| `@IsOptional()` | Always first when the field is optional (skips other validators when absent) |
| `@IsString`, `@IsBoolean`, `@IsNumber`, `@IsUUID`, `@IsEnum(E)` | Built-in type checks |
| `@IsArray`, `@ArrayNotEmpty`, `@ValidateNested({ each: true })`, `@Type(() => X)` | Nested object arrays |
| `@MinLength`, `@MaxLength`, `@Min`, `@Max` | Bounds |
| `@IsEmail()`, `@IsUrl()` | Format checks |
| `@IsE164Phone()` | E.164 phone (custom — see [@doc/patterns/validation-pattern](patterns/validation-pattern)) |
| `@IsAdultDateOfBirth()`, `@IsChildDateOfBirth(opts)` | Age constraints |
| `@TransformToUTCDate()` + `@IsISO8601Date()` | Robust date parsing |

> Don't read `campusId` from request body. The campus is enforced at the guard layer via `@RequireCampusAccess()` and surfaced through `@CampusContext()`. Including it in the body lets the user override it. See [@doc/guides/working-with-campuses](guides/working-with-campuses).

## Response DTOs

### Conventions

- File: `{entity}.response.ts`.
- Every public field has `@Expose()`. Without it, `excludeExtraneousValues: true` strips the field from the output.
- Use `@Type(() => NestedResponse)` for nested objects.
- Provide `@ApiProperty` for OpenAPI metadata.

### Example

```typescript
import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

export class StudentResponse {
  @Expose()
  @ApiProperty({ format: "uuid" })
  id: string;

  @Expose()
  @ApiProperty()
  campusId: string;

  @Expose()
  @ApiProperty()
  studentCode: string;

  @Expose()
  @ApiProperty()
  fullName: string;

  @Expose()
  @ApiProperty({ nullable: true })
  email: string | null;

  @Expose()
  @ApiProperty({ nullable: true })
  phoneNumber: string | null;

  @Expose()
  @ApiProperty({ nullable: true, type: String, format: "date-time" })
  dateOfBirth: Date | null;

  @Expose()
  @ApiProperty({ enum: ["MALE", "FEMALE"], nullable: true })
  gender: string | null;

  @Expose()
  @ApiProperty({ enum: ["WAITING", "ACTIVE", "TRIAL", "DEFERRED", "GRADUATED", "DROPPED"] })
  status: string;

  @Expose()
  @ApiProperty()
  isArchived: boolean;

  @Expose()
  @ApiProperty({ type: [StudentGuardianResponse] })
  @Type(() => StudentGuardianResponse)
  guardians?: StudentGuardianResponse[];

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;
}
```

### How responses are produced

The controller returns the **domain entity** (or use case result). `StandardResponseInterceptor`:

1. Walks the entity tree, calling `toPlain()` on `ValueObject` instances.
2. For `Entity<Props>` instances, flattens `_id` + `props` into a plain object and recurses.
3. Calls `plainToInstance(ResponseDto, plain, { excludeExtraneousValues: true, ... })`.
4. Wraps the result in `{ success, message, data, pagination?, timestamp }`.

This means **you never manually construct a Response DTO** — the interceptor does it. Just declare the shape with `@Expose()`.

See [@doc/patterns/standard-response-pattern](patterns/standard-response-pattern) for the full pipeline.

## Date Handling

Wire format: ISO 8601 with `Z` (UTC). Frontend converts to local for display.

| Direction | Decorator | Example |
|-----------|-----------|---------|
| Request | `@TransformToUTCDate()` + `@IsDateOfBirth()` / `@IsISO8601Date()` | parses `"2020-05-15"` → `2020-05-15T00:00:00.000Z` |
| Response | `Date` field with `@Expose()` | interceptor calls `toISOString()` on the Date before serializing |

## Pagination & Filtering on List Endpoints

Use `@StandardRequestParam()` to bind the standard query DTO and `@StandardResponse({ isPaginated: true, allowedSortFields, allowedFilterFields })` to enable validation + Swagger:

```typescript
@Get()
@RequireCampusAccess()
@StandardResponse({
  type: StudentResponse,
  isPaginated: true,
  allowedSortFields: ["createdAt", "studentCode", "fullName"],
  allowedFilterFields: ["fullName", "email", "phoneNumber", "isArchived"],
})
async findAll(
  @CampusContext() campusId: string,
  @StandardRequestParam() params: StandardRequestDto,
) { … }
```

See [@doc/guides/pagination-and-filtering](guides/pagination-and-filtering) for the full filter/sort grammar.

## Best Practices

1. **One Request DTO per use case input.** Don't reuse across endpoints.
2. **Don't share Request and Response DTOs.** They have different responsibilities.
3. **Keep `campusId` out of Request bodies.** It's controller context, not user input.
4. **`@Expose()` on every Response field.** Forgetting it silently drops the field.
5. **Document with `@ApiProperty`.** The Swagger UI is the API spec.
6. **Use the typed enum, not a string union.** `enum: Gender` makes Swagger render a dropdown.
7. **Custom validators for compound rules.** A regex-in-the-DTO works once; a validator in `@/core/validators` is reusable.
