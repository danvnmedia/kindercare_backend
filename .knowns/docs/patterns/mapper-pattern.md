---
title: Mapper Pattern
createdAt: '2026-01-03T19:52:08.384Z'
updatedAt: '2026-01-03T20:04:26.333Z'
description: Prisma to Domain conversion pattern
tags:
  - patterns
  - prisma
  - mapper
---
# Mapper Pattern

## Overview

Mappers are responsible for converting data between Prisma database models and Domain entities. They provide a clean separation between the persistence layer and domain layer, ensuring the domain remains independent of database implementation details.

## Location

```
src/infra/persistence/prisma/mapper/prisma-{entity}.mapper.ts
```

## Required Methods

### 1. toDomain(prismaEntity: PrismaEntityWithRelations): DomainEntity

Converts a Prisma model with full relations to a Domain entity. Use this when you need the complete entity with all nested relations.

```typescript
static toDomain(prismaStaff: PrismaStaffWithRelations): Staff {
  const staffProps = {
    fullName: prismaStaff.fullName,
    email: prismaStaff.email,
    phoneNumber: prismaStaff.phoneNumber,
    staffType: prismaStaff.staffType as StaffType,
    address: prismaStaff.address,
    dateOfBirth: prismaStaff.dateOfBirth,
    gender: prismaStaff.gender as Gender | null,
    startDate: prismaStaff.startDate,
    userId: prismaStaff.userId,
    isArchived: prismaStaff.isArchived,
    createdAt: prismaStaff.createdAt,
    updatedAt: prismaStaff.updatedAt,
  };

  return Staff.create(staffProps, prismaStaff.id);
}
```

### 2. toDomainSimple(prismaEntity: PrismaEntity): DomainEntity

Converts a Prisma model WITHOUT nested relations. Use this to prevent circular references when mapping nested entities.

```typescript
static toDomainSimple(prismaStaff: PrismaStaff): Staff {
  const staffProps = {
    fullName: prismaStaff.fullName,
    email: prismaStaff.email,
    phoneNumber: prismaStaff.phoneNumber,
    staffType: prismaStaff.staffType as StaffType,
    address: prismaStaff.address,
    dateOfBirth: prismaStaff.dateOfBirth,
    gender: prismaStaff.gender as Gender | null,
    startDate: prismaStaff.startDate,
    userId: prismaStaff.userId,
    isArchived: prismaStaff.isArchived,
    createdAt: prismaStaff.createdAt,
    updatedAt: prismaStaff.updatedAt,
  };

  return Staff.create(staffProps, prismaStaff.id);
}
```

### 3. toPrisma(entity: DomainEntity): Prisma.EntityUncheckedCreateInput

Converts a Domain entity to Prisma create input. Used when saving new entities.

```typescript
static toPrisma(staff: Staff): Prisma.StaffUncheckedCreateInput {
  return {
    id: staff.id,
    fullName: staff.fullName,
    email: staff.email,
    phoneNumber: staff.phoneNumber,
    staffType: staff.staffType,
    address: staff.address,
    dateOfBirth: staff.dateOfBirth,
    gender: staff.gender,
    startDate: staff.startDate,
    userId: staff.userId,
    isArchived: staff.isArchived,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  };
}
```

### 4. toPrismaUpdate(entity: DomainEntity): Prisma.EntityUpdateInput

Converts a Domain entity to Prisma update input. Excludes immutable fields like `id` and `createdAt`.

```typescript
static toPrismaUpdate(staff: Staff): Prisma.StaffUpdateInput {
  const updateData: Prisma.StaffUpdateInput = {
    fullName: staff.fullName,
    email: staff.email,
    phoneNumber: staff.phoneNumber,
    staffType: staff.staffType,
    address: staff.address,
    dateOfBirth: staff.dateOfBirth,
    gender: staff.gender,
    startDate: staff.startDate,
    isArchived: staff.isArchived,
    updatedAt: staff.updatedAt,
  };

  // Handle relation updates separately
  if (staff.userId) {
    updateData.user = { connect: { id: staff.userId } };
  } else {
    updateData.user = { disconnect: true };
  }

  return updateData;
}
```

### 5. toDomainArray(prismaEntities: PrismaEntityWithRelations[]): DomainEntity[]

Batch conversion of Prisma models to Domain entities.

```typescript
static toDomainArray(prismaStaffs: PrismaStaffWithRelations[]): Staff[] {
  return prismaStaffs.map((prismaStaff) =>
    PrismaStaffMapper.toDomain(prismaStaff),
  );
}
```

## Type Definitions

Define types for Prisma models with relations at the top of the mapper file:

```typescript
import { Staff as PrismaStaff, User as PrismaUser } from "@prisma/client";

type PrismaStaffWithRelations = PrismaStaff & {
  user?: PrismaUser | null;
};
```

## Best Practices

1. **Always cast enums**: Prisma enums are strings, cast them to domain enum types
   ```typescript
   staffType: prismaStaff.staffType as StaffType
   ```

2. **Handle nullability**: Use null coalescing for optional fields
   ```typescript
   content: post.content ?? null
   ```

3. **Use toDomainSimple for nested entities**: Prevents infinite loops in circular references

4. **Export mapper class, not instance**: Use static methods for consistency
   ```typescript
   export class PrismaStaffMapper {
     static toDomain(...)
   }
   ```

5. **Handle relation updates in toPrismaUpdate**: Use connect/disconnect for relations
   ```typescript
   updateData.user = staff.userId 
     ? { connect: { id: staff.userId } } 
     : { disconnect: true };
   ```

## Example: Complete Mapper

```typescript
import { Staff as PrismaStaff, User as PrismaUser, Prisma } from "@prisma/client";
import { Staff } from "@/domain/user-management/entities/staff.entity";
import { Gender } from "@/domain/user-management/enums/gender.enum";
import { StaffType } from "@/domain/user-management/enums/staff-type.enum";

type PrismaStaffWithRelations = PrismaStaff & {
  user?: PrismaUser | null;
};

export class PrismaStaffMapper {
  static toDomain(prismaStaff: PrismaStaffWithRelations): Staff { ... }
  static toDomainSimple(prismaStaff: PrismaStaff): Staff { ... }
  static toPrisma(staff: Staff): Prisma.StaffUncheckedCreateInput { ... }
  static toPrismaUpdate(staff: Staff): Prisma.StaffUpdateInput { ... }
  static toDomainArray(prismaStaffs: PrismaStaffWithRelations[]): Staff[] { ... }
}
```
