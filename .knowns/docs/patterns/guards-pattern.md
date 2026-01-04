---
title: Guards Pattern
createdAt: '2026-01-03T19:52:36.724Z'
updatedAt: '2026-01-03T20:28:52.819Z'
description: Authentication and Authorization pattern
tags:
  - patterns
  - guards
  - security
---
# Guards Pattern

> Authentication & Authorization. Located in src/infra/http/guards/

---

## JWT Guard

1. Checks for @Public() decorator first
2. Extracts token from Authorization header
3. Verifies token with JwtService
4. Attaches user to request
5. Throws UnauthorizedException if invalid

---

## Email Verified Guard

1. Checks for @SkipEmailVerification() decorator
2. Gets user from request
3. Checks user.emailVerified
4. Throws ForbiddenException if not verified

---

## Role Guard

1. Gets required roles from @Roles() decorator
2. If no roles specified, allows access
3. Gets user from request
4. Checks if user.role is in required roles
5. Throws ForbiddenException if not authorized

---

## Composition

Apply guards at controller or method level:

@UseGuards(JwtGuard, EmailVerifiedGuard, RoleGuard)
@Roles(UserRole.ADMIN)

Execution order: JWT -> EmailVerified -> Role

---

## Key Decorators

1. @Public() - Skip JWT authentication
2. @SkipEmailVerification() - Skip email verification check
3. @Roles(...roles) - Require specific roles
