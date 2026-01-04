---
title: Controller Pattern
createdAt: '2026-01-03T19:52:09.955Z'
updatedAt: '2026-01-03T20:05:11.221Z'
description: HTTP request handling pattern
tags:
  - patterns
  - controller
  - http
---
# Controller Pattern

## Overview

Controllers handle HTTP requests, validate input, authorize access, and delegate business logic to use cases. They follow NestJS conventions with custom decorators for standardized responses.

## Location

```
src/infra/http/controllers/{module}/{entity}.controller.ts
```

## Required Decorators

### Class Level

```typescript
@ApiTags("Staff")                    // Swagger grouping
@ApiBearerAuth("JWT")                // Auth documentation
@Controller("staff")                 // Route prefix
@UseGuards(ClerkAuthGuard)           // Authentication guard
@UseGuards(ClerkAuthGuard, RolesGuard) // With role-based authorization
export class StaffController { }
```

### Method Level

```typescript
@Post()
@Get()
@Get(":id")
@Patch(":id")
@Delete(":id")
```

## Custom Decorators

### @StandardResponse

Wraps response in standard format with automatic Swagger documentation.

```typescript
@StandardResponse({
  type: StaffResponse,           // Response DTO class
  message: "Staff created",      // Optional success message
  isPaginated: true,             // For list endpoints
  isArray: true,                 // For array responses
  allowedSortFields: ["createdAt", "fullName"],
  allowedFilterFields: ["email", "staffType"],
})
```

### @StandardRequestParam

Extracts and validates query parameters for paginated list endpoints.

```typescript
@Get()
@StandardResponse({
  type: PostResponse,
  isPaginated: true,
  allowedSortFields: ["createdAt", "updatedAt", "title", "status"],
  allowedFilterFields: ["title", "status", "publishAt"],
})
async findMany(@StandardRequestParam() params: StandardRequest) {
  return this.listPostsUseCase.execute(params);
}
```

### @Roles

Restricts endpoint access to specific roles.

```typescript
@Post()
@Roles("admin", "principal")  // Only admin or principal can access
@UseGuards(ClerkAuthGuard, RolesGuard)
async create() { }
```

### @CurrentUser

Extracts authenticated user from request.

```typescript
@Post()
async create(
  @Body() dto: CreatePostRequest,
  @CurrentUser() user: User,
): Promise<Post> {
  return this.createPostUseCase.execute(dto, user);
}
```

## Swagger Documentation

### @ApiOperation

```typescript
@ApiOperation({
  summary: "Create a new staff member",
  description: "Creates a new staff member with personal information...",
})
```

### @ApiParam

```typescript
@ApiParam({
  name: "id",
  description: "Staff UUID",
  example: "123e4567-e89b-12d3-a456-426614174000",
})
```

## Guards

### ClerkAuthGuard

Validates JWT token and attaches user to request.

```typescript
@UseGuards(ClerkAuthGuard)
```

### RolesGuard

Checks if user has required roles (must be used with ClerkAuthGuard).

```typescript
@UseGuards(ClerkAuthGuard, RolesGuard)
@Roles("admin")
```

## Controller Structure

```typescript
import {
  Controller, Post, Get, Delete, Patch,
  Param, Body, Query, UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from "@nestjs/swagger";
import { StandardResponse, StandardRequestParam } from "@/core/modules/standard-response/decorators";
import { ClerkAuthGuard } from "../guards/clerk-auth.guard";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";
import { CurrentUser } from "../decorators";

// Use Cases
import { CreateStaffUseCase } from "@/application/user-management/use-cases/staff/create-staff.use-case";
import { GetStaffByIdUseCase } from "@/application/user-management/use-cases/staff/get-staff-by-id.use-case";

// DTOs
import { CreateStaffRequest, StaffResponse } from "../../dtos/user-management/staff";

@Controller("staff")
@ApiTags("Staff")
@ApiBearerAuth("JWT")
@UseGuards(ClerkAuthGuard)
export class StaffController {
  constructor(
    private readonly createStaffUseCase: CreateStaffUseCase,
    private readonly getStaffByIdUseCase: GetStaffByIdUseCase,
  ) {}

  @Post()
  @StandardResponse({
    message: "Staff created successfully",
    type: StaffResponse,
  })
  @ApiOperation({ summary: "Create a new staff member" })
  async create(@Body() dto: CreateStaffRequest) {
    return await this.createStaffUseCase.execute(dto);
  }

  @Get(":id")
  @StandardResponse({
    message: "Staff retrieved successfully",
    type: StaffResponse,
  })
  @ApiOperation({ summary: "Get staff by ID" })
  @ApiParam({ name: "id", description: "Staff UUID" })
  async findById(@Param("id") id: string) {
    return await this.getStaffByIdUseCase.execute(id);
  }
}
```

## Standard CRUD Endpoints

| Method | Path | Use Case | Returns |
|--------|------|----------|---------|
| POST | / | CreateUseCase | Entity |
| GET | / | GetAllUseCase | Paginated list |
| GET | /:id | GetByIdUseCase | Single entity |
| PATCH | /:id | UpdateUseCase | Updated entity |
| DELETE | /:id | DeleteUseCase | void |

## Best Practices

1. **Inject use cases, not repositories**: Controllers delegate to use cases
2. **Use @StandardResponse for all endpoints**: Ensures consistent response format
3. **Validate input with DTOs**: Use class-validator decorators in request DTOs
4. **Document with Swagger**: Every endpoint should have @ApiOperation
5. **Handle auth at controller level**: Use guards, not manual checks
6. **Return domain entities**: Let interceptors transform to response DTOs
7. **Keep controllers thin**: Business logic belongs in use cases
