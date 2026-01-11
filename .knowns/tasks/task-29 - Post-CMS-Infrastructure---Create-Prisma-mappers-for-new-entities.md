---
id: '29'
title: 'Post & CMS: Infrastructure - Create Prisma mappers for new entities'
status: done
priority: medium
labels:
  - post
  - infrastructure
  - mapper
  - phase-3
createdAt: '2026-01-09T03:10:11.358Z'
updatedAt: '2026-01-09T17:36:17.624Z'
timeSpent: 200
---
# Post & CMS: Infrastructure - Create Prisma mappers for new entities

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create Prisma mappers for bidirectional mapping between Prisma models and domain entities.

**Context:**
- Follow existing mapper patterns (see PrismaStaffMapper, PrismaGuardianMapper)
- Include toDomain(), toDomainSimple(), toPrisma(), toPrismaUpdate(), toDomainArray()
- Handle relation mapping (connect/disconnect)
- Reference: @doc/patterns/mapper-pattern

**Mappers to Create:**
1. PrismaPostCategoryMapper
2. PrismaPostReactionMapper
3. PrismaPostCommentMapper (handle self-reference for nesting)
4. PrismaPostApprovalRequestMapper
5. PrismaCampusSettingMapper

**Update Existing:**
- PrismaPostMapper: handle JSON content field
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrismaPostCategoryMapper created with toDomain, toPrisma, toPrismaUpdate, toDomainArray
- [ ] #2 PrismaPostReactionMapper created with toDomain, toPrisma, toDomainArray
- [ ] #3 PrismaPostCommentMapper created with toDomain, toPrisma, toPrismaUpdate (handles parent relation)
- [ ] #4 PrismaPostApprovalRequestMapper created with toDomain, toPrisma, toPrismaUpdate
- [ ] #5 PrismaCampusSettingMapper created with toDomain, toPrisma, toPrismaUpdate
- [ ] #6 PrismaPostMapper updated to handle JSON content correctly
- [ ] #7 All mappers export from index.ts
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create PrismaPostCategoryMapper in src/infra/persistence/prisma/mapper/:
   - Define PrismaPostCategoryWithRelations type
   - toDomain(): map Prisma model to PostCategory entity
   - toPrisma(): map entity to Prisma.PostCategoryUncheckedCreateInput
   - toPrismaUpdate(): map entity to Prisma.PostCategoryUpdateInput
   - toDomainArray(): batch mapping
2. Create PrismaPostReactionMapper:
   - toDomain(): map to PostReaction entity
   - toPrisma(): map to create input
   - toDomainArray(): batch mapping
3. Create PrismaPostCommentMapper:
   - Define type with optional parent relation
   - toDomain(): handle parent_comment_id self-reference
   - toPrisma(): create input with parent connect
   - toPrismaUpdate(): update with soft delete fields
   - toDomainArray(): batch mapping
4. Create PrismaPostApprovalRequestMapper:
   - Define type with user relations
   - toDomain(): include submitter/reviewer info
   - toPrisma(): create with snapshot fields
   - toPrismaUpdate(): update status and review fields
5. Create PrismaCampusSettingMapper:
   - Simple mapping (no relations)
   - toDomain(), toPrisma(), toPrismaUpdate()
6. Update PrismaPostMapper:
   - Handle content as Json type (Prisma.JsonValue)
   - Map contentText, contentVersion
   - Handle pinning fields
   - Handle soft delete fields
7. Update src/infra/persistence/prisma/mapper/index.ts exports
<!-- SECTION:PLAN:END -->

