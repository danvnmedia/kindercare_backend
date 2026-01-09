---
id: '17'
title: 'Phase 4.1: Post and Content Management Campus Scoping'
status: todo
priority: high
labels:
  - domain
  - post
  - content
  - campus-scoping
  - phase-4
createdAt: '2026-01-06T04:30:27.497Z'
updatedAt: '2026-01-06T04:30:27.497Z'
timeSpent: 0
---
# Phase 4.1: Post and Content Management Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update Post, PostAudience, and related content management entities for campus scoping.

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## Post Entity Changes

### Domain Layer
**File**: src/domain/content-management/entities/post.entity.ts
- Add: campusId property (required)
- Posts are campus-isolated (cannot target audiences across campuses)

**File**: src/domain/content-management/entities/post-audience.entity.ts
- Add: campusId property (required)
- Audience targets (class, grade, student) must be from same campus

### Application Layer

**Port Update**: src/application/content-management/ports/post.repository.ts
- Add: findByCampusId(campusId, params)
- Update: findAll to filter by campusId

**Use Case Updates**:
- create-post.use-case.ts
  - Require campusId
  - Validate audiences are from same campus
  - Author must have access to campus
  
- list-posts.use-case.ts
  - Filter by campusId
  
- All transition use cases
  - Verify campus access
  
- add-attachment.use-case.ts
  - Verify file belongs to same campus

### Infrastructure Layer

**Repository**: prisma-post.repository.ts
- Update for campus filtering
- Include campus relation
- Validate audience targets are in same campus

**Mapper**: prisma-post.mapper.ts
- Add campusId mapping

### HTTP Layer

**Controller**: post.controller.ts
- Get campusId from auth context
- Pass campusId to all use cases
- Validate author has campus access

**DTOs**:
- create-post.request.ts - Add campusId (optional if from context)
- post.response.ts - Add campusId

## Validation Rules
- Post audiences (classes, grades, students) must all be from the post's campus
- Only users with campus access can create/view posts
- Attachments must reference files from same campus
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Post entity has campusId property
- [ ] #2 PostAudience entity has campusId property
- [ ] #3 Post repository updated for campus filtering
- [ ] #4 Create-post requires campusId
- [ ] #5 Create-post validates audiences are in same campus
- [ ] #6 List-posts filters by campus
- [ ] #7 Post transitions verify campus access
- [ ] #8 Attachments verify file is from same campus
- [ ] #9 Mappers updated with campusId
- [ ] #10 DTOs include campusId
- [ ] #11 Cross-campus posts prevented
- [ ] #12 Tests updated
<!-- AC:END -->

