---
title: Working with Campuses
createdAt: '2026-01-11T05:37:53.394Z'
updatedAt: '2026-01-11T05:41:41.499Z'
description: Developer guide for working with campus context in the multi-campus system
---
# Content

Write your documentation here.


# Working with Campuses

This guide covers how to work with campus context when developing features in the Kindercare backend.

## Quick Reference

| Task | Pattern |
|------|---------|
| Get campus ID in controller | \ |
| Require campus access | \ |
| Include in use case input | \ |
| Filter in repository | \ |
| Check campus ownership | \ |

## Controller Patterns

### Requiring Campus Access

Use the \ decorator to enforce campus context:

\
### Decorator Options

\
### Optional Campus Context

For endpoints that work with or without campus:

\
## Use Case Patterns

### Input Interface

Always include campusId as a required field:

\
### Campus Ownership Validation

Validate that related entities belong to the same campus:

\
### Campus-Scoped Uniqueness

Use campus-scoped repository methods:

\
## Repository Patterns

### Port Definition

Define campus-scoped methods in the repository port:

\
### Prisma Implementation

Use compound keys for efficient lookups:

\
### Paginated Queries

Always include campus filter in paginated queries:

\
## Entity Patterns

### Creating Campus-Scoped Entities

Domain entities validate campusId in the factory method:

\
### Campus ID is Immutable

Once set, campusId cannot be changed. It's excluded from update types:

\
## Swagger Documentation

Document the campus header requirement:

\
## Testing Patterns

### Unit Tests

Mock campus context in use case tests:

\
### Cross-Campus Prevention Tests

Test that cross-campus operations are rejected:

\
## Common Mistakes

| Mistake | Correct Approach |
|---------|-----------------|
| Not validating campusId | Always check entity.campusId === input.campusId |
| Using global findByEmail | Use findByEmailInCampus for uniqueness |
| Forgetting @RequireCampusAccess | Add decorator to campus-scoped endpoints |
| Missing @ApiHeader | Document X-Campus-Id in Swagger |
| Allowing campusId update | Keep campusId immutable after creation |
