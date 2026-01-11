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

## 2. Request Processing Flow

```
HTTP Request
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. ValidationPipe (Global)              │
│    - whitelist: true                    │
│    - forbidNonWhitelisted: true         │
│    - transform: true                    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. Guards (@UseGuards)                  │
│    - ClerkAuthGuard: JWT verification   │
│    - RolesGuard: Permission check       │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. Interceptors (Pre-handler)           │
│    - StandardResponseInterceptor        │
│    - UserInterceptor                    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. Controller                           │
│    - Route handling                     │
│    - DTO mapping                        │
│    - Delegates to Use Case              │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. Use Case (Application Layer)         │
│    - Business logic orchestration       │
│    - Injects repositories via tokens    │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 6. Repository (Infrastructure)          │
│    - Prisma database operations         │
│    - Entity ↔ Prisma mapping            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 7. Interceptors (Post-handler)          │
│    - StandardResponseInterceptor        │
│    - Entity → DTO transformation        │
│    - Pagination wrapper                 │
└─────────────────────────────────────────┘
    │
    ▼
HTTP Response { success, message, data, pagination?, timestamp }
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

### Campus-Aware Request Flow

```
HTTP Request (with X-Campus-Id header)
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. ValidationPipe (Global)              │
│    - whitelist: true                    │
│    - forbidNonWhitelisted: true         │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 2. ClerkAuthGuard                       │
│    - Verify JWT token                   │
│    - Set request.clerkId                │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 3. UserInterceptor                      │
│    - Fetch User entity by clerkId       │
│    - Set request.user (with roles)      │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 4. CampusGuard (@RequireCampusAccess)   │
│    - Extract campusId from request      │
│    - Validate UUID format               │
│    - Check campus exists & is active    │
│    - Verify user has campus access      │
│    - Set request.campusId               │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 5. RolesGuard / PermissionsGuard        │
│    - Get roles for campus context       │
│    - Check required roles/permissions   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 6. Controller                           │
│    - @CampusContext() extracts campusId │
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
