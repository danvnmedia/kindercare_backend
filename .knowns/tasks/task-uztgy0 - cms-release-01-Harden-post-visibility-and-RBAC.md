---
id: uztgy0
title: "[cms-release-01] Harden post visibility and RBAC"
status: done
priority: high
labels:
  - from-spec
  - cms
  - security
createdAt: '2026-07-12T03:37:31.279Z'
updatedAt: '2026-07-12T05:32:45.464Z'
timeSpent: 251
spec: specs/2026-07-11-cms-api-contract-alignment
fulfills:
  - AC-8
  - AC-9
---
# [cms-release-01] Harden post visibility and RBAC

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Fix scheduled visibility, action-specific transition permissions, batch revise mapping, and post.manage public-comment moderation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Future publishAt posts are excluded from visible list/detail/pinned/engagement paths
- [x] #2 Update-class transitions require post.update; approve/reject require post.review; post.manage remains implied
- [x] #3 post.manage can moderate public comments
- [x] #4 Regression tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Harden visibility predicates and engagement lookup. 2. Enforce action-specific single and batch transition permissions. 3. Add post.manage comment moderation. 4. Add regression tests and build.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented scheduled publishAt visibility predicates for public list/detail/pinned reads plus domain engagement cutoff; centralized approve/reject=post.review and submit/revise/publish/archive=post.update mapping for single and batch transitions with post.manage implied; authorized post.manage public-comment moderation. Added repository, entity, transition, batch, reaction, and deletion regressions. Validation: content-management suite 27/27 suites, 165/165 tests; focused regressions 7/7 suites, 65/65 tests; npm run build passed; knowns validate --entity uztgy0 passed.
Reopened: integrated review P1 remediation for campus-safe unpublished post visibility and explicit cross-campus/global-role regressions.
Integrated review P1 remediation: unpublished post broad visibility now delegates exclusively to campus-safe userHasPostPermission(post.review), which preserves post.manage implication and only bypasses for globally assigned system roles. Added campus A system-role plus campus B post.read regression and global system-role control. Verification: 5 related suites / 62 tests passed; touched-file ESLint passed with pre-existing module-type warning; npm run build passed; scoped git diff --check passed; task validation passed. Canonical docs unchanged.
<!-- SECTION:NOTES:END -->

