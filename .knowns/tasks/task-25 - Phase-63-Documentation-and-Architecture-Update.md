---
id: '25'
title: 'Phase 6.3: Documentation and Architecture Update'
status: todo
priority: low
labels:
  - documentation
  - architecture
  - phase-6
createdAt: '2026-01-06T04:37:25.648Z'
updatedAt: '2026-01-06T04:37:25.648Z'
timeSpent: 0
---
# Phase 6.3: Documentation and Architecture Update

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update project documentation to reflect the multi-campus architecture.

Depends on all Phase 1-6 tasks completion.
See @doc/migrations/multi-campus-migration for context.

## Documentation Updates

### Update Existing Docs

**@doc/architecture/module-and-request-flow**
- Add campus context flow
- Update module diagram with campus module
- Document campus isolation

**@doc/patterns/repository-pattern**
- Add examples of campus-filtered queries
- Document campus validation in repositories

**@doc/patterns/use-case-pattern**
- Add campus context as standard input
- Document campus validation patterns

### Create New Docs

**@doc/architecture/multi-campus**
- Explain campus isolation model
- Document global vs campus-scoped entities
- Explain RBAC campus scoping

**@doc/guides/working-with-campuses**
- How to create a new campus
- How to assign users to campuses
- How to switch campus context

### Update API Documentation (Swagger)
- Add X-Campus-Id header documentation
- Document campus context in endpoints
- Update response schemas with campusId

### Update DBML Diagrams
- Remove old diagram or mark deprecated
- Ensure new diagram is accurate

### Update README
- Mention multi-campus capability
- Update setup instructions if needed
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Module and request flow diagram updated
- [ ] #2 Repository pattern doc includes campus examples
- [ ] #3 Use case pattern doc includes campus context
- [ ] #4 New multi-campus architecture doc created
- [ ] #5 Working with campuses guide created
- [ ] #6 Swagger/OpenAPI updated with campus header
- [ ] #7 DBML diagrams updated
- [ ] #8 README updated with multi-campus info
<!-- AC:END -->

