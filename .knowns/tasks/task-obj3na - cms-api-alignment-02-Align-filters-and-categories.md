---
id: obj3na
title: "[cms-api-alignment-02] Align filters and categories"
status: done
priority: high
labels:
  - from-spec
  - go-mode
  - cms
createdAt: '2026-07-10T20:29:20.631Z'
updatedAt: '2026-07-10T21:26:07.784Z'
timeSpent: 3372
spec: specs/2026-07-11-cms-api-contract-alignment
fulfills:
  - AC-3
  - AC-4
---
# [cms-api-alignment-02] Align filters and categories

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Make advertised filters and category validation/order match runtime behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Advertised filters are implemented or removed
- [x] #2 Category limits and one-based order align
- [x] #3 Default category order is deterministic
- [x] #4 Focused tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect existing dirty hardening changes. 2. Complete only remaining filter/category contract gaps. 3. Add focused tests. 4. Validate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Aligned implemented/advertised filters, category limits, one-based order, and deterministic repository ordering. Focused tests/build passed.
<!-- SECTION:NOTES:END -->

