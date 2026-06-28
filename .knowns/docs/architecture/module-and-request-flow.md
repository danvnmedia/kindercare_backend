---
title: Module and Request Flow
createdAt: '2026-01-03T19:51:47.531Z'
updatedAt: '2026-01-11T05:19:13.356Z'
description: Module import hierarchy and request processing flow documentation
tags:
  - architecture
  - nestjs
  - flow
---
# Module Import & Request Processing Flow

## 1. Module Hierarchy

### Root Module (AppModule)
```
AppModule
├── ConfigModule.forRoot()      # Global configuration
├── StandardResponseModule      # Response interceptor & query services
├── HttpModule                  # HTTP presentation layer
│   ├── AuthModule             # Authentication endpoints
│   ├── UserManagementModule   # Users, Roles, Students, Guardians, Staff
│   ├── FileManagementModule   # File upload/download
│   └── ClassManagementModule  # Classes, Enrollments
├── QueueModule                 # Bull queue for async jobs
├── FileManagementModule        # Direct file operations
├── ContentManagementModule     # Posts, Content
└── CronjobModule              # Scheduled tasks
```

### Feature Module Example (UserManagementModule)
```typescript
@Module({
  imports: [
    PrismaModule,           // Database access
    ClerkModule,            // Authentication & Identity
    StandardResponseModule, // Query service
  ],
  controllers: [StudentController, GuardianController, ...],
  providers: [
    // Use Cases
    CreateStudentUseCase,
    GetAllStudentsUseCase,
    // Repository Token Binding
    { provide: 'STUDENT_REPOSITORY', useClass: PrismaStudentRepository },
    // Port Binding
    { provide: StudentCodeGeneratorPort, useClass: StudentCodeGeneratorService },
  ],
})
```

## 2. Request Processing Flow (Hybrid Auth Pattern)

The application uses a **hybrid middleware + request-scoped service** pattern for authentication context management. See @doc/architecture/adr-hybrid-authentication-context-architecture for the decision record.

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. AuthMiddleware (Global)              │
│    - Verify Clerk token                 │
│    - Set request.clerkId/sessionId      │
│    - Non-blocking (continues on failure)│
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. ValidationPipe (Global)              │
│    - whitelist: true                    │
│    - forbidNonWhitelisted: true         │
│    - transform: true                    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. Guards (@UseGuards)                  │
│    - ClerkAuthGuard: Check clerkId set  │
│    - CampusGuard: Validate campus access│
│    - RolesGuard: Permission check       │
│    (All use RequestContext for user)    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. Interceptors (Pre-handler)           │
│    - StandardResponseInterceptor        │
│    - ClassSerializerInterceptor         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. Controller                           │
│    - Route handling                     │
│    - @CurrentUser() via RequestContext  │
│    - @CampusContext() for campus ID     │
│    - Delegates to Use Case              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 6. Use Case (Application Layer)         │
│    - Business logic orchestration       │
│    - Injects repositories via tokens    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 7. Repository (Infrastructure)          │
│    - Prisma database operations         │
│    - Entity ↔ Prisma mapping            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 8. Interceptors (Post-handler)          │
│    - StandardResponseInterceptor        │
│    - Entity → DTO transformation        │
│    - Pagination wrapper                 │
└─────────────────────────────────────────┘
    │
    ▼
HTTP Response { success, message, data, pagination?, timestamp }
```

### RequestContext Service

The `RequestContext` service is request-scoped and provides:
- **Lazy Loading**: User fetched only when first accessed
- **Caching**: Single DB call per request (even across multiple guards)
- **Type Safety**: Typed access to user, clerkId, campusId

```typescript
@Injectable({ scope: Scope.REQUEST })
export class RequestContext {
  async getUser(): Promise<User | null>     // Lazy-loaded, cached
  get clerkId(): string | null              // From AuthMiddleware
  get campusId(): string | null             // From CampusGuard
}
```

## 3. Dependency Injection Patterns

### Pattern A: Repository Token
```typescript
// Module registration
{ provide: 'STUDENT_REPOSITORY', useClass: PrismaStudentRepository }

// Use Case injection
@Inject('STUDENT_REPOSITORY')
private readonly studentRepository: StudentRepository
```

### Pattern B: Port/Adapter (Abstract Class)
```typescript
// Port definition (Application layer)
export abstract class StudentCodeGeneratorPort {
  abstract generateNextCode(): Promise<string>;
}

// Module registration
{ provide: StudentCodeGeneratorPort, useClass: StudentCodeGeneratorService }

// Use Case injection (no @Inject needed)
constructor(private readonly studentCodeGenerator: StudentCodeGeneratorPort) {}
```

### Pattern C: Direct Service Injection
```typescript
// Use Case injection
constructor(private readonly identityPort: IdentityPort) {}
```

## 4. Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER                         │
│  src/domain/                                            │
│  ├── Entities (Student, Guardian, Class, Post)          │
│  ├── Value Objects (Email, Money)                       │
│  └── Enums (Gender, StudentStatus)                      │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ depends on
┌─────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                      │
│  src/application/                                       │
│  ├── Use Cases (CreateStudent, GetAllStudents)          │
│  └── Ports (StudentRepository, IdentityPort)            │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ implements
┌─────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                    │
│  src/infra/                                             │
│  ├── http/ (Controllers, Guards, Interceptors, DTOs)    │
│  ├── persistence/prisma/ (Repositories, Mappers)        │
│  ├── external-services/clerk/ (Authentication)          │
│  ├── queue/ (Bull processors)                           │
│  └── storage/ (File storage)                            │
└─────────────────────────────────────────────────────────┘
```

### Key Principles
- **Domain** has no dependencies on other layers
- **Application** depends only on Domain, defines Ports (interfaces)
- **Infrastructure** implements Ports, handles external concerns
- **Dependency Rule**: Dependencies point inward (toward Domain)



## 5. Campus Context Flow

The multi-campus architecture adds campus isolation to the request processing flow. All campus-scoped endpoints require a validated campus context.

### Campus Context Extraction

Campus ID is extracted from requests in this priority order:
1. **Header**: `X-Campus-Id` (preferred)
2. **Route parameter**: `:campusId`
3. **Query parameter**: `?campusId=`

### Campus-Aware Request Flow (Hybrid Auth Pattern)

```
HTTP Request (with X-Campus-Id header)
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. AuthMiddleware                       │
│    - Verify Clerk token                 │
│    - Set request.clerkId/sessionId      │
│    - Initialize RequestContext          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. ValidationPipe (Global)              │
│    - whitelist: true                    │
│    - forbidNonWhitelisted: true         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. ClerkAuthGuard                       │
│    - Check clerkId exists               │
│    - Reject if not authenticated        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. CampusGuard (@RequireCampusAccess)   │
│    - Extract campusId from request      │
│    - Validate UUID format               │
│    - Check campus exists & is active    │
│    - RequestContext.getUser() (cached)  │
│    - Verify user has campus access      │
│    - Set RequestContext.campusId        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. RolesGuard / PermissionsGuard        │
│    - RequestContext.getUser() (cached)  │
│    - Get roles for campus context       │
│    - Check required roles/permissions   │
│    (User already cached - no DB call)   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 6. Controller                           │
│    - @CampusContext() extracts campusId │
│    - @CurrentUser() via request.user    │
│    - Passes to use case input           │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 7. Use Case (Campus-Scoped)             │
│    - Validates campus ownership         │
│    - Cross-campus prevention checks     │
│    - Campus-filtered repository calls   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 8. Repository (Campus-Filtered)         │
│    - Applies where: { campusId }        │
│    - Campus-scoped uniqueness checks    │
└─────────────────────────────────────────┘
```

### Performance Comparison

| Pattern | DB Fetches per Request | Notes |
|---------|----------------------|-------|
| Previous (UserInterceptor + Guards) | 3-4 | Each guard fetched user independently |
| Current (Hybrid + RequestContext) | **1** | Lazy-loaded, cached per request |

### Campus Module in Module Hierarchy

```
AppModule
├── ConfigModule.forRoot()
├── StandardResponseModule
├── HttpModule
│   ├── AuthModule
│   ├── CampusModule            # NEW: Campus CRUD
│   ├── UserManagementModule
│   ├── FileManagementModule
│   ├── ClassManagementModule
│   ├── ContentManagementModule
│   ├── RBACModule              # NEW: Permissions & Roles
│   └── AttendanceModule
├── QueueModule
└── CronjobModule
```

### Campus Guard Configuration

```typescript
@RequireCampusAccess({
  required: true,        // Throw 400 if missing
  requireActive: true,   // Campus must be active
  checkUserAccess: true, // Verify user has access
  allowGlobalAdmin: true // Admin bypass enabled
})
```

### Campus Isolation Principles

1. **Global User Identity**: Users are global, authenticated via Clerk
2. **Campus-Scoped Everything Else**: Staff, students, classes, posts are campus-scoped
3. **Role-Based Campus Access**: Users have roles assigned per-campus
4. **Global Roles**: System default roles (campusId: null) apply everywhere
5. **Immutable Campus Binding**: Entity campusId cannot change after creation
