---
title: CMS RBAC compressed permissions handoff
description: 'Handoff for migrating CMS/post endpoints from role-name checks to compressed post.* RBAC permissions.'
createdAt: '2026-07-01T14:18:02.391Z'
updatedAt: '2026-07-10T22:04:57.618Z'
tags:
  - cms
  - rbac
  - handoff
  - archived
---

# CMS RBAC compressed permissions handoff

## Goal

Migrate CMS/post authorization to a compact RBAC model while keeping parent visibility relationship-based.

## Permission set

- post.create
- post.read
- post.update
- post.delete
- post.list
- post.review
- post.manage

## Hierarchy

post.manage implies all CMS admin operations, including review, categories, pinning, management comments, settings, and post CRUD/list/read. The code should still declare concrete route permissions so roles can be configured flexibly.

## API mapping

- POST /posts -> post.create
- GET /posts -> post.list
- GET /posts/:id -> post.read
- PATCH /posts/:id -> post.update
- DELETE /posts/:id -> post.delete
- POST /posts/:id/attachments -> post.update
- DELETE /posts/:id/attachments/:attachmentId -> post.update
- PATCH /posts/:id/attachments/reorder -> post.update
- GET /posts/pending-approval -> post.review
- POST /posts/:id/transition -> post.review for approve/reject; post.update for submit/revise/publish/archive via use-case action checks
- POST /posts/batch-transition -> same as transition
- POST /posts/:id/pin -> post.manage
- DELETE /posts/:id/pin -> post.manage
- GET /posts/:id/history -> post.read
- GET /posts/:id/approval-history -> post.review
- GET /post-categories -> post.list
- POST/PATCH/DELETE/reorder post-categories -> post.manage
- management comments -> post.manage
- campus CMS settings -> post.manage
- public comments/reactions -> post.read plus post visibility and campus settings

## Parent and staff visibility

Parents/guardians remain relationship/audience based. RBAC alone is insufficient for parent post access. Staff/teacher/manager/admin use RBAC and campus access. If teacher read scope must be class-only, add a separate visibility rule later; current backend treats non-guardian as campus-wide.

## Implementation notes

- Add missing permissions to SYSTEM_PERMISSIONS.
- Replace CMS RolesGuard usages with PermissionsGuard + @Permissions.
- Replace approval/pin hasSystemRole hard-blocks with hasSystemRole OR effective post permission.
- Ensure comments/reactions use findVisibleById so parent audience visibility applies before engagement.

## Verification

Run targeted RBAC/CMS tests and inspect controller metadata where available.


## Implementation update 2026-07-01

Implemented compressed CMS RBAC permissions.

Changed backend:

- Added seeded permissions: post.review, post.manage.
- Migrated CMS controllers to PermissionsGuard/@Permissions:
  - post.controller.ts
  - post-category.controller.ts
  - comment.controller.ts
  - campus-setting.controller.ts
- Added application helper userHasPostPermission(user, campusId, permissionId).
- Approval/reject now allow system role OR post.review/post.manage.
- Pin/unpin now allow system role OR post.manage.
- Comment/reply/reaction read/write paths now use findVisibleById(campusId, user) before engagement to preserve parent audience visibility.

Validation:

- npm test -- post-permission.helper.spec.ts rbac-campus-scoping.integration.spec.ts seed-permissions.use-case.spec.ts --runInBand --json --outputFile=cms-rbac-jest-results.json
- Result: 3 suites passed, 31 tests passed.

Known follow-up:

- Assign post.review/post.manage to the intended Manager/Admin roles in DB/seed data.
- Decide whether teacher/staff post read should remain campus-wide or become class-scoped.
