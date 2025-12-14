# Module Import & Request Processing Flow

> Tài liệu mô tả cấu trúc module và luồng xử lý request trong hệ thống.

---

## Table of Contents

1. [Module Import Flow](#module-import-flow)
2. [Request Processing Flow](#request-processing-flow)
3. [Dependency Injection Pattern](#dependency-injection-pattern)
4. [Layer Architecture](#layer-architecture)

---

## Module Import Flow

### Module Hierarchy

```
AppModule (ROOT)
├── ConfigModule.forRoot()
├── StandardResponseModule
├── HttpModule
│   ├── AuthModule
│   │   ├── ClerkModule
│   │   ├── PrismaModule
│   │   └── StandardResponseModule
│   ├── UserManagementModule
│   │   ├── PrismaModule
│   │   ├── ClerkModule
│   │   └── StandardResponseModule
│   └── FileManagementModule
│       ├── StorageModule
│       ├── ClerkModule
│       ├── UserManagementModule
│       └── PrismaModule
├── QueueModule
├── ContentManagementModule
└── CronjobModule
```

### Key Module Files

| Module | File Location | Purpose |
|--------|---------------|---------|
| AppModule | `src/app.module.ts` | Root module, imports all top-level modules |
| HttpModule | `src/infra/http/http.module.ts` | Aggregator for HTTP-related feature modules |
| AuthModule | `src/infra/http/modules/auth.module.ts` | Authentication endpoints |
| UserManagementModule | `src/infra/http/modules/user-management.module.ts` | User, Role, Student, Guardian management |
| FileManagementModule | `src/infra/http/modules/file-management/file-management.module.ts` | File upload/storage |
| ContentManagementModule | `src/infra/http/modules/content-management.module.ts` | Content management (Posts, etc.) |
| ClerkModule | `src/infra/external-services/clerk/clerk.module.ts` | Clerk authentication provider |
| PrismaModule | `src/infra/persistence/prisma/prisma.module.ts` | Database connection |
| StandardResponseModule | `src/core/modules/standard-response/standard-response.module.ts` | Global response formatting |
| StorageModule | `src/infra/storage/storage.module.ts` | File storage services |
| QueueModule | `src/infra/queue/queue.module.ts` | Message queue handling |

### Module Registration Example

```typescript
// Feature Module Example: user-management.module.ts
@Module({
  imports: [
    PrismaModule,
    ClerkModule,
    StandardResponseModule,
  ],
  controllers: [
    RoleController,
    StudentController,
    GuardianController,
  ],
  providers: [
    // Repositories with DI tokens
    {
      provide: "USER_REPOSITORY",
      useClass: PrismaUserRepository,
    },
    {
      provide: "ROLE_REPOSITORY",
      useClass: PrismaRoleRepository,
    },
    {
      provide: "STUDENT_REPOSITORY",
      useClass: PrismaStudentRepository,
    },
    {
      provide: "GUARDIAN_REPOSITORY",
      useClass: PrismaGuardianRepository,
    },
    // Use Cases
    CreateRoleUseCase,
    GetRoleByIdUseCase,
    GetAllRolesUseCase,
    // ... more use cases
  ],
  exports: [
    "USER_REPOSITORY",
    "ROLE_REPOSITORY",
    "STUDENT_REPOSITORY",
    "GUARDIAN_REPOSITORY",
  ],
})
export class UserManagementModule {}
```

---

## Request Processing Flow

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  1. HTTP REQUEST                                                 │
│     POST /api/students + Bearer token                           │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. GLOBAL VALIDATION PIPE (main.ts)                            │
│     - Validates request body against DTO                        │
│     - Whitelist allowed properties                              │
│     - Transform types                                           │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. GUARD - ClerkAuthGuard                                      │
│     - Check if route is @Public()                               │
│     - Call AuthenticationPort.verifyAuthentication()            │
│     - Attach request.clerkId = userId                           │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. INTERCEPTOR - UserInterceptor                               │
│     - Extract clerkId from request                              │
│     - Fetch User from DB via UserRepository                     │
│     - Attach request.user = user                                │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. CONTROLLER                                                   │
│     - Extract @CurrentUser() decorator                          │
│     - Call UseCase.execute()                                    │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. USE CASE                                                     │
│     - Business logic validation                                 │
│     - Domain operations                                         │
│     - Call Repository methods                                   │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. REPOSITORY                                                   │
│     - PrismaRepository implementation                           │
│     - Execute database query via PrismaService                  │
│     - Map DB result to Domain Entity via Mapper                 │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  8. INTERCEPTOR - StandardResponseInterceptor                   │
│     - Format response to standard structure                     │
│     - { success, message, data, timestamp }                     │
└─────────────────────────┬───────────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  9. HTTP RESPONSE                                                │
│     200 OK + JSON                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Detailed Flow Example: Create Student

```typescript
// 1. Request arrives at POST /api/students

// 2. ValidationPipe validates CreateStudentRequest DTO
@IsNotEmpty()
@IsString()
fullName: string;

// 3. ClerkAuthGuard verifies JWT token
@UseGuards(ClerkAuthGuard)

// 4. UserInterceptor fetches user from DB
@UseInterceptors(UserInterceptor)

// 5. Controller receives request
@Post()
async create(
  @Body() dto: CreateStudentRequest,
  @CurrentUser() user: UserPayload,
): Promise<Student> {
  // 6. Call Use Case
  return this.createStudentUseCase.execute(dto);
}

// 7. Use Case executes business logic
async execute(input: CreateStudentInput): Promise<Student> {
  // Validate guardian exists
  const guardians = await this.guardianRepository.findByIds(input.guardianIds);

  // Create student entity
  const student = Student.create({...});

  // Save via repository
  await this.studentRepository.save(student);

  return student;
}

// 8. Repository saves to database
async save(student: Student): Promise<void> {
  const data = PrismaStudentMapper.toPersistence(student);
  await this.prisma.student.create({ data });
}

// 9. StandardResponseInterceptor formats response
{
  success: true,
  message: "Student created successfully",
  data: { id: "...", fullName: "...", ... },
  timestamp: "2025-12-13T..."
}
```

### Application Bootstrap (main.ts)

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global Response Interceptor
  const standardResponseInterceptor = app.get(StandardResponseInterceptor);
  app.useGlobalInterceptors(standardResponseInterceptor);

  // API Prefix
  app.setGlobalPrefix("api", {
    exclude: [{ path: "docs", method: RequestMethod.GET }],
  });

  // CORS & Swagger
  app.enableCors({...});
  SwaggerModule.setup("docs", app, document);

  await app.listen(process.env.PORT ?? 3000);
}
```

---

## Dependency Injection Pattern

### 1. Repository Token Pattern

```typescript
// Module Registration
@Module({
  providers: [
    {
      provide: "STUDENT_REPOSITORY",
      useClass: PrismaStudentRepository,
    },
  ],
  exports: ["STUDENT_REPOSITORY"],
})
export class UserManagementModule {}

// Use Case Injection
@Injectable()
export class CreateStudentUseCase {
  constructor(
    @Inject("STUDENT_REPOSITORY")
    private readonly studentRepository: StudentRepository,
  ) {}
}
```

### 2. Port/Adapter Pattern

```typescript
// Port Definition (Application Layer)
// src/application/ports/authentication.port.ts
export interface AuthenticationPort {
  verifyAuthentication(request: any): Promise<AuthenticationResult>;
}

// Adapter Implementation (Infrastructure Layer)
// src/infra/external-services/clerk/clerk-authentication.adapter.ts
@Injectable()
export class ClerkAuthenticationAdapter implements AuthenticationPort {
  constructor(
    @Inject("ClerkClient") private readonly clerkClient: ClerkClient,
  ) {}

  async verifyAuthentication(request: ExpressRequest): Promise<AuthenticationResult> {
    // Clerk SDK authentication logic
  }
}

// Module Registration
@Module({
  providers: [
    {
      provide: "AUTHENTICATION_PORT",
      useClass: ClerkAuthenticationAdapter,
    },
  ],
  exports: ["AUTHENTICATION_PORT"],
})
export class ClerkModule {}

// Guard Injection
@Injectable()
export class ClerkAuthGuard implements CanActivate {
  constructor(
    @Inject("AUTHENTICATION_PORT")
    private readonly authenticationPort: AuthenticationPort,
  ) {}
}
```

### 3. Direct Service Injection

```typescript
// No token needed for services
@Injectable()
export class PrismaStudentRepository implements StudentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queryService: PrismaQueryService,
  ) {}
}
```

### 4. Multi-Provider Injection in Controller

```typescript
@Controller("students")
export class StudentController {
  constructor(
    private readonly createStudentUseCase: CreateStudentUseCase,
    private readonly getAllStudentsUseCase: GetAllStudentsUseCase,
    private readonly linkStudentWithGuardianUseCase: LinkStudentWithGuardianUseCase,
    private readonly unlinkStudentFromGuardianUseCase: UnlinkStudentFromGuardianUseCase,
    private readonly getStudentGuardiansUseCase: GetStudentGuardiansUseCase,
  ) {}
}
```

---

## Layer Architecture

### Directory Structure

```
src/
├── domain/                      # Domain Layer - Entities, Business Logic
│   ├── user-management/
│   │   ├── user.entity.ts
│   │   ├── role.entity.ts
│   │   ├── student.entity.ts
│   │   └── guardian.entity.ts
│   └── file-management/
│       └── file.entity.ts
│
├── application/                 # Application Layer - Use Cases, Ports
│   ├── user-management/
│   │   ├── use-cases/
│   │   │   ├── role/
│   │   │   ├── student/
│   │   │   └── guardian/
│   │   └── ports/
│   │       ├── role.repository.ts
│   │       ├── student.repository.ts
│   │       └── guardian.repository.ts
│   ├── file-management/
│   │   └── use-cases/
│   └── ports/
│       └── authentication.port.ts
│
├── infra/                       # Infrastructure Layer
│   ├── persistence/            # Database
│   │   └── prisma/
│   │       ├── prisma.module.ts
│   │       ├── prisma.service.ts
│   │       ├── repositories/
│   │       │   ├── prisma-role.repository.ts
│   │       │   ├── prisma-student.repository.ts
│   │       │   └── prisma-guardian.repository.ts
│   │       └── mapper/
│   │           ├── prisma-role.mapper.ts
│   │           ├── prisma-student.mapper.ts
│   │           └── prisma-guardian.mapper.ts
│   │
│   ├── external-services/      # External APIs
│   │   └── clerk/
│   │       ├── clerk.module.ts
│   │       ├── clerk-authentication.adapter.ts
│   │       └── identity.service.ts
│   │
│   ├── http/                   # HTTP Layer
│   │   ├── http.module.ts
│   │   ├── controllers/
│   │   │   ├── auth.controller.ts
│   │   │   └── user-management/
│   │   │       ├── role.controller.ts
│   │   │       ├── student.controller.ts
│   │   │       └── guardian.controller.ts
│   │   ├── guards/
│   │   │   └── clerk-auth.guard.ts
│   │   ├── interceptors/
│   │   │   └── user.interceptor.ts
│   │   ├── decorators/
│   │   │   ├── current-user.decorator.ts
│   │   │   └── public.decorator.ts
│   │   ├── dtos/
│   │   └── modules/
│   │       ├── auth.module.ts
│   │       ├── user-management.module.ts
│   │       └── file-management/
│   │
│   ├── storage/                # File Storage
│   │   └── storage.module.ts
│   │
│   └── queue/                  # Message Queue
│       └── queue.module.ts
│
└── core/                       # Core Utilities
    ├── value-objects/
    ├── exceptions/
    └── modules/
        └── standard-response/
            ├── standard-response.module.ts
            └── interceptors/
                └── standard-response.interceptor.ts
```

### Dependency Rule

```
┌─────────────────────────────────────────────────────────────────┐
│                         DOMAIN LAYER                            │
│  Entities, Value Objects, Business Rules                        │
│  NO dependencies on other layers                                │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ depends on
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
│  Use Cases, Port Interfaces                                     │
│  Depends on Domain only                                         │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │ implements
┌─────────────────────────────────────────────────────────────────┐
│                     INFRASTRUCTURE LAYER                        │
│  Repositories, External Services, HTTP Controllers              │
│  Implements Application ports                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Port/Adapter Mapping

| Port (Application) | Adapter (Infrastructure) |
|--------------------|--------------------------|
| `AuthenticationPort` | `ClerkAuthenticationAdapter` |
| `RoleRepository` | `PrismaRoleRepository` |
| `StudentRepository` | `PrismaStudentRepository` |
| `GuardianRepository` | `PrismaGuardianRepository` |
| `UserRepository` | `PrismaUserRepository` |
| `FileRepository` | `PrismaFileRepository` |

---

## Key Files Reference

| File | Purpose | Location |
|------|---------|----------|
| `main.ts` | Application bootstrap, global middleware | `src/main.ts` |
| `app.module.ts` | Root module | `src/app.module.ts` |
| `clerk-auth.guard.ts` | JWT authentication | `src/infra/http/guards/clerk-auth.guard.ts` |
| `user.interceptor.ts` | User data injection | `src/infra/http/interceptors/user.interceptor.ts` |
| `standard-response.interceptor.ts` | Response formatting | `src/core/modules/standard-response/interceptors/standard-response.interceptor.ts` |
| `authentication.port.ts` | Auth port interface | `src/application/ports/authentication.port.ts` |
| `clerk-authentication.adapter.ts` | Clerk implementation | `src/infra/external-services/clerk/clerk-authentication.adapter.ts` |
| `prisma.service.ts` | Database client | `src/infra/persistence/prisma/prisma.service.ts` |

---

**Last Updated**: 2025-12-13
