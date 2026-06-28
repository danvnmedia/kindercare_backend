---
title: Multi-Campus Architecture
createdAt: '2026-01-11T05:37:51.937Z'
updatedAt: '2026-01-13T00:45:49.594Z'
description: Comprehensive documentation of the multi-campus federated architecture
---
# Multi-Campus Architecture

## Overview

The Kindercare backend uses a **federated multi-campus architecture** that enables a single application instance to serve multiple campuses (schools) while maintaining strict data isolation.

**Core Principle**: Global User Identity + Campus-Scoped Everything Else

## Architecture Diagram

```
Campus (Root)
  ├── Roles (campusId: UUID | null for system roles)
  │   ├── RolePermission → Permission (module.action pattern)
  │   └── StaffType → defaultRole
  ├── UserRole (joins User to Role with campusId context)
  │   ├── campusId: null = GLOBAL assignment (applies everywhere)
  │   └── campusId: UUID = CAMPUS-SPECIFIC (applies only to that campus)
  ├── User
  │   ├── userRoles[] (with campus context)
  │   └── Methods: getRolesForCampus(), getGlobalRoles(), hasRoleInCampus()
  ├── Staff (campusId, staffTypeId → defaultRole)
  ├── Guardian (campusId)
  ├── Student (campusId, unique per campus)
  ├── Class (campusId, unique per campus)
  ├── GradeLevel (campusId)
  ├── Subject (campusId)
  ├── SchoolYear (campusId)
  ├── Post (campusId)
  ├── PostCategory (campusId)
  ├── PostAudience (campusId)
  ├── File (campusId)
  └── StudentAttendanceSummary (campusId)
```

## Entity Classification

### Global Entities (No campusId)

| Entity | Description |
|--------|-------------|
| User | Authenticated identity (Clerk) |
| Permission | Atomic permissions (module.action) |

### Campus-Scoped Entities (Required campusId)

| Entity | Immutable campusId | Unique Constraints |
|--------|-------------------|-------------------|
| Staff | Yes | [campusId, email], [campusId, phoneNumber], [campusId, userId] |
| Student | Yes | [campusId, studentCode] |
| Guardian | Yes | [campusId, email], [campusId, phoneNumber], [campusId, userId] |
| Class | Yes | [campusId, schoolYearId, gradeLevelId, name] |
| GradeLevel | Yes | [campusId, name], [campusId, order] |
| Subject | Yes | [campusId, name] |
| SchoolYear | Yes | [campusId, name] |
| Post | Yes | - |
| PostCategory | Yes | [campusId, name] |
| PostAudience | Yes | - |
| File | Yes | - |
| StudentAttendanceSummary | Yes | - |
| StaffType | Yes | [campusId, name] |
| CampusSetting | Yes | One-to-one with Campus |

### Hybrid Entities (Optional campusId)

| Entity | campusId Meaning |
|--------|-----------------|
| Role | null = system default, UUID = campus-specific |
| UserRole | null = global assignment, UUID = campus-scoped |

## Campus Isolation Mechanisms

### 1. Database Level

All campus-scoped tables have:
- `campusId` column with foreign key to `Campus` table
- Composite unique constraints: `[campusId, name]`, `[campusId, email]`, etc.

Example from Prisma schema:
```prisma
model Student {
  id        String @id @default(uuid()) @db.Uuid
  campusId  String @map("campus_id") @db.Uuid
  // ...
  campus    Campus @relation(fields: [campusId], references: [id])

  @@unique([campusId, studentCode])
  @@index([campusId])
}
```

### 2. Repository Level

Repositories filter all queries by campusId using typed methods:

```typescript
// Example from PrismaStudentRepository
async findByCampusId(campusId: string): Promise<Student[]> {
  const students = await this.prisma.student.findMany({
    where: { campusId },  // Always scoped to campus
    include: { guardians: { ... } },
  });
  return PrismaStudentMapper.toDomainArray(students);
}

async findByEmailInCampus(campusId: string, email: string): Promise<Student | null> {
  const prismaStudent = await this.prisma.student.findFirst({
    where: { campusId, email },  // Campus-scoped lookup
  });
  return prismaStudent ? PrismaStudentMapper.toDomain(prismaStudent) : null;
}
```

PrismaQueryService provides reusable filtering for paginated queries:
```typescript
await this.prismaQueryService.executeQuery(
  this.prisma,
  'student',
  params,
  { where: { campusId } },  // Inject campus filter
  StudentMapper,
);
```

### 3. Use Case Level

Use cases validate campus ownership:
- Input interfaces require campusId
- Cross-campus prevention checks
- Related entity campus validation

### 4. HTTP Level

Guards enforce campus access:
- CampusGuard validates X-Campus-Id header
- Checks user has roles in the campus
- Global admin bypass available

```typescript
@Controller('students')
@RequireCampusAccess()  // Validates X-Campus-Id header
export class StudentController { }
```

## RBAC (Role-Based Access Control)

### Permission Model

Permissions are atomic, code-based identifiers following the pattern `module.action`:

```typescript
// Permission ID format: {module}.{action}
// Examples: 'student.create', 'class.read', 'post.delete'

// Valid modules
const VALID_MODULES = [
  'campus', 'student', 'guardian', 'staff', 'class',
  'grade_level', 'subject', 'school_year', 'post',
  'file', 'role', 'user', 'attendance', 'staff_type',
  'report', 'setting'
];

// Valid actions
const VALID_ACTIONS = [
  'create', 'read', 'update', 'delete', 'list',
  'manage', 'assign', 'export', 'import'
];
```

### Role Scoping

| Type | campusId | Applies To | isSystemDefault |
|------|----------|------------|-----------------|
| System Default | null | All campuses | true |
| Campus-Specific | UUID | One campus only | false |

```prisma
model Role {
  id              String  @id @default(uuid()) @db.Uuid
  campusId        String? @map("campus_id") @db.Uuid  // null = system role
  name            String
  isSystemDefault Boolean @default(false)
  isSystemRole    Boolean @default(false)  // true grants global admin bypass

  @@unique([campusId, name])  // Role names unique per campus
}
```

### User Role Assignments

Users can have different roles in different campuses:

```typescript
// User with multiple campus-scoped roles
const user = {
  roleAssignments: [
    { role: adminRole, campusId: null },           // Global admin - applies everywhere
    { role: teacherRole, campusId: 'campus-a' },   // Teacher only in Campus A
    { role: principalRole, campusId: 'campus-b' }, // Principal only in Campus B
  ]
};

// Get roles for a specific campus (includes global roles)
user.getRolesForCampus('campus-a');  // Returns [adminRole, teacherRole]
user.getRolesForCampus('campus-b');  // Returns [adminRole, principalRole]
```

### Access Check Flow

1. Extract campusId from request (header > route > query)
2. Get user's roles for that campus (includes global roles)
3. Collect permissions from all applicable roles
4. Check if user has required permission

```typescript
// PermissionsGuard flow
const campusId = getCampusFromRequest(request);
const applicableRoles = user.getRolesForCampus(campusId);
const userPermissions = collectPermissions(applicableRoles);
return requiredPermissions.some(p => userPermissions.has(p));
```

## StaffType and Default Roles

StaffTypes are campus-specific and can have a default role:

```prisma
model StaffType {
  id            String  @id @default(uuid()) @db.Uuid
  campusId      String  @map("campus_id") @db.Uuid
  name          String
  defaultRoleId String? @map("default_role_id") @db.Uuid

  campus      Campus @relation(fields: [campusId], references: [id])
  defaultRole Role?  @relation(fields: [defaultRoleId], references: [id])

  @@unique([campusId, name])
}
```

- When creating staff with a StaffType, they inherit that StaffType's default role
- Each campus can define its own StaffTypes
- StaffTypes link to campus-specific or global roles

## Request Flow with Campus Context

```
HTTP Request
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ CampusGuard                                                │
├────────────────────────────────────────────────────────────┤
│ 1. Extract campusId from:                                  │
│    - x-campus-id header (priority)                         │
│    - Route parameter :campusId                             │
│    - Query parameter ?campusId=                            │
│ 2. Validate UUID format                                    │
│ 3. Check campus exists in database                         │
│ 4. Check campus.isActive === true                          │
│ 5. Check user access:                                      │
│    - If isGlobalAdmin(user) → ALLOW (bypass)               │
│    - If hasCampusAccess(user, campusId) → ALLOW            │
│    - Else → DENY (403 Forbidden)                           │
│ 6. Store campusId on request context                       │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ PermissionsGuard                                           │
├────────────────────────────────────────────────────────────┤
│ 1. Get required permissions from @Permissions decorator    │
│ 2. Get campusId from request context                       │
│ 3. Get user roles for campus:                              │
│    - Global roles (campusId: null)                         │
│    - Campus-specific roles (campusId: UUID)                │
│ 4. Collect all permissions from applicable roles           │
│ 5. Check user has ANY required permission                  │
└────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────┐
│ Controller / Use Case                                      │
├────────────────────────────────────────────────────────────┤
│ - Access validated campusId via getCampusFromRequest()     │
│ - All repository queries scoped to this campusId           │
│ - Cross-campus data access prevented                       │
└────────────────────────────────────────────────────────────┘
```

## Cross-Campus Prevention

The system prevents cross-campus data access:

1. **Enrollment**: Cannot enroll Campus A student in Campus B class
2. **Staff Assignment**: Cannot assign Campus A staff to Campus B class
3. **Content**: Posts target audiences within the same campus only
4. **Files**: Files are scoped to uploading user's campus context

## Key Design Decisions

1. **Immutable campusId**: Once set, an entity's campus cannot change
2. **Soft Delete Pattern**: Campus uses isActive flag, not hard delete
3. **Global Admin Bypass**: Users with isSystemRole=true can access any campus
4. **Filter Injection**: Use cases inject campusId into query filters
5. **Double Validation**: Both use case AND repository validate campus
6. **Composite Unique Constraints**: Prevent duplicate names within same campus

## Key Files Reference

| Component | File Path |
|-----------|-----------|
| Campus Schema | prisma/schema.prisma |
| CampusGuard | src/infra/http/guards/campus.guard.ts |
| PermissionsGuard | src/infra/http/guards/permissions.guard.ts |
| Campus Context | src/infra/http/context/campus-context.ts |
| Permission Entity | src/domain/rbac/entities/permission.entity.ts |
| Role Entity | src/domain/user-management/role.entity.ts |
| User Entity | src/domain/user-management/user.entity.ts |
| PrismaQueryService | src/core/modules/standard-response/services/prisma-query.service.ts |
