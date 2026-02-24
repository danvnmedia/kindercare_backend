---
id: y7a0jw
title: 'Fix performance, duplication, and async issues in frontend and mobile'
status: in-progress
priority: high
labels:
  - performance
  - refactoring
  - frontend
  - mobile
createdAt: '2026-02-01T17:45:03.203Z'
updatedAt: '2026-02-11T17:42:24.400Z'
timeSpent: 0
---
# Fix performance, duplication, and async issues in frontend and mobile

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Comprehensive fixes for issues identified in audit: performance optimizations, code deduplication, memory leak prevention, and async issue resolution
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Frontend: Add user feedback for rate-limited actions
- [ ] #2 Frontend: Add error boundaries at route level
- [ ] #3 Frontend: Add redirect lock in CampusGuard
- [ ] #4 Frontend: Implement comment pagination
- [ ] #5 Mobile: Add try-catch for image picker
- [ ] #6 Mobile: Add mounted checks before showModalBottomSheet
- [ ] #7 Mobile: Consolidate setState calls
- [ ] #8 Mobile: Extract repeated widgets (SearchTextField, CardListItem)
- [ ] #9 Mobile: Parallelize API calls with Future.wait
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Cross-repo audit 2026-02-12: fixed mobile attendance test DI, async discarded futures, backend bulk attendance duplicate guard + batched validation, role user validation parallelized; mobile tests pass, backend tests pass, lint debt remains pre-existing

2026-02-12 pass-2: backend lint burndown 38->0; added tests bulk-record-attendance duplicate guard + role user dedup; npm lint PASS, npm test PASS (31 suites / 476 tests)
<!-- SECTION:NOTES:END -->

