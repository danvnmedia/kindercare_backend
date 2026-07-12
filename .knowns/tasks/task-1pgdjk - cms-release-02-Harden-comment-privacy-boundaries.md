---
id: 1pgdjk
title: "[cms-release-02] Harden comment privacy boundaries"
status: done
priority: high
labels:
  - from-spec
  - cms
  - security
createdAt: '2026-07-12T03:37:32.467Z'
updatedAt: '2026-07-12T03:45:52.996Z'
timeSpent: 0
spec: specs/2026-07-11-cms-api-contract-alignment
fulfills:
  - AC-10
---
# [cms-release-02] Harden comment privacy boundaries

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reject replies to management comments and mask deleted comment content in all serialized trees and mutations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Public reply rejects non-public parent without saving
- [x] #2 Deleted comment API payloads never expose stored content
- [x] #3 Nested and mutation serializers use the same masking rule
- [x] #4 Regression tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Enforce PUBLIC parent subtype. 2. Centralize deleted-content response masking. 3. Cover tree and mutation serialization. 4. Run targeted tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented PUBLIC-parent rejection before post/settings lookup or save. Centralized deleted comment content masking as [deleted] in CommentResponse class-transformer mapping; direct mutation and recursively nested tree serialization share the rule while PostComment retains stored audit content. Validation: 4 targeted suites/18 tests passed; scoped ESLint and Prettier passed; npm run build passed; knowns validate --entity 1pgdjk passed.
<!-- SECTION:NOTES:END -->

