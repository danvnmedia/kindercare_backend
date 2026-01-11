---
title: Multi-Campus Architecture
createdAt: '2026-01-11T05:37:51.937Z'
updatedAt: '2026-01-11T05:39:09.328Z'
description: Comprehensive documentation of the multi-campus federated architecture
---
# Content

Write your documentation here.


# Multi-Campus Architecture

## Overview

The Kindercare backend uses a **federated multi-campus architecture** that enables a single application instance to serve multiple campuses (schools) while maintaining strict data isolation.

**Core Principle**: Global User Identity + Campus-Scoped Everything Else

## Architecture Diagram

\
## Entity Classification

### Global Entities (No campusId)

| Entity | Description |
|--------|-------------|
| User | Authenticated identity (Clerk) |
| Permission | Atomic permissions (module.action) |

### Campus-Scoped Entities (Required campusId)

| Entity | Immutable campusId |
|--------|-------------------|
| Staff | Yes |
| Student | Yes |
| Guardian | Yes |
| Class | Yes |
| GradeLevel | Yes |
| Subject | Yes |
| SchoolYear | Yes |
| Post | Yes |
| File | Yes |
| StudentAttendance | Yes |
| StaffType | Yes |

### Hybrid Entities (Optional campusId)

| Entity | campusId Meaning |
|--------|-----------------|
| Role | null = system default, UUID = campus-specific |
| UserRole | null = global assignment, UUID = campus-scoped |

## Campus Isolation Mechanisms

### 1. Database Level

All campus-scoped tables have:
- \ column with foreign key to \ table
- Composite unique constraints: \, \, etc.

### 2. Repository Level

Repositories filter all queries by campusId:
- - - PrismaQueryService with 
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

## RBAC (Role-Based Access Control)

### Permission Model

Permissions are atomic, code-based identifiers:
\
### Role Scoping

| Type | campusId | Applies To |
|------|----------|------------|
| System Default | null | All campuses |
| Campus-Specific | UUID | One campus only |

### User Role Assignments

Users can have different roles in different campuses:
\
### Access Check Flow

1. Extract campusId from request
2. Get user's roles for that campus (includes global roles)
3. Collect permissions from all applicable roles
4. Check if user has required permission

## StaffType and Default Roles

StaffTypes are campus-specific and can have a default role:
- When creating staff with a StaffType, they inherit that StaffType's default role
- Each campus can define its own StaffTypes
- StaffTypes link to campus-specific or global roles

## Request Flow with Campus Context

\
## Cross-Campus Prevention

The system prevents cross-campus data access:

1. **Enrollment**: Cannot enroll Campus A student in Campus B class
2. **Staff Assignment**: Cannot assign Campus A staff to Campus B class
3. **Content**: Posts target audiences within the same campus only
4. **Files**: Files are scoped to uploading user's campus context

## Key Design Decisions

1. **Immutable campusId**: Once set, an entity's campus cannot change
2. **Soft Delete Pattern**: Campus uses isActive flag, not hard delete
3. **Global Admin Bypass**: Users with global admin role can access any campus
4. **Filter Injection**: Use cases inject campusId into query filters
5. **Double Validation**: Both use case AND repository validate campus
