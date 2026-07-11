---
id: 4ncv1g
title: "[cms-api-alignment-03] Return state and truthful API metadata"
status: done
priority: high
labels:
  - from-spec
  - go-mode
  - cms
createdAt: '2026-07-10T20:29:20.654Z'
updatedAt: '2026-07-10T21:26:09.357Z'
timeSpent: 3372
spec: specs/2026-07-11-cms-api-contract-alignment
fulfills:
  - AC-5
  - AC-6
  - AC-7
---
# [cms-api-alignment-03] Return state and truthful API metadata

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Return post state after attachment reorder and align OpenAPI/runtime defaults and statuses.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Attachment reorder returns resulting post state
- [x] #2 OpenAPI pagination default equals runtime
- [x] #3 Documented HTTP statuses equal runtime
- [x] #4 Focused tests pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Return resulting post from reorder use case/controller. 2. Align shared metadata/status behavior. 3. Add focused tests. 4. Validate.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Attachment reorder returns resulting post; list default and CMS POST docs/runtime statuses aligned. Focused tests/build passed.
<!-- SECTION:NOTES:END -->

