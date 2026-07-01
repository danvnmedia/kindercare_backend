---
id: ykdmt7
title: Implement CMS compressed RBAC permissions
status: done
priority: high
labels:
  - cms
  - rbac
createdAt: '2026-07-01T14:18:12.900Z'
updatedAt: '2026-07-01T14:27:41.407Z'
timeSpent: 0
spec: frontend-handoff/cms-rbac-compressed-permissions-handoff
---
# Implement CMS compressed RBAC permissions

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Migrate CMS/post authorization to compressed post.* permissions and preserve parent audience visibility.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SYSTEM_PERMISSIONS includes post.review and post.manage
- [x] #2 CMS controllers use PermissionsGuard/@Permissions instead of role-name checks where applicable
- [x] #3 approval/pin admin-only use cases allow hasSystemRole or assigned RBAC permission
- [x] #4 comments/reactions enforce post visibility before engagement
- [x] #5 targeted tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented compressed CMS RBAC permissions per handoff. Added post.review/post.manage, migrated CMS controllers to PermissionsGuard, added post permission helper, replaced approval/pin system-role-only checks with system-role OR RBAC permission, enforced visibility for comments/reactions, and validated targeted tests: 3 suites/31 tests passed.
<!-- SECTION:NOTES:END -->

