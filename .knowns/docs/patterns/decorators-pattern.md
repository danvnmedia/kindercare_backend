---
title: Decorators Pattern
createdAt: '2026-01-03T19:52:38.347Z'
updatedAt: '2026-01-03T20:29:18.687Z'
description: Custom HTTP decorators pattern
tags:
  - patterns
  - decorators
  - http
---
# Decorators Pattern

> Custom HTTP decorators. Located in src/infra/http/decorators/

---

## Public

Marks endpoint as public (no auth required):
- IS_PUBLIC_KEY = 'isPublic'
- @Public() sets metadata to true
- JwtGuard checks this to skip authentication

---

## Skip Email Verification

Allows access without verified email:
- SKIP_EMAIL_VERIFICATION_KEY = 'skipEmailVerification'
- @SkipEmailVerification() sets metadata to true
- EmailVerifiedGuard checks this to skip verification

---

## Roles

Restricts access to specific roles:
- ROLES_KEY = 'roles'
- @Roles(...roles: UserRole[]) sets required roles
- RoleGuard checks if user.role is in required list

---

## User (CurrentUser)

Extracts authenticated user from request:
- createParamDecorator with ExecutionContext
- @User() returns full user object
- @User('id') returns specific property

---

## Usage Examples

- @Public() - Skip authentication for public endpoints
- @SkipEmailVerification() - Allow unverified users
- @Roles(UserRole.USER) - Require USER role
- @Roles(UserRole.ADMIN) - Require ADMIN role
- @User() user - Get full user object
- @User('id') userId - Get user ID only
