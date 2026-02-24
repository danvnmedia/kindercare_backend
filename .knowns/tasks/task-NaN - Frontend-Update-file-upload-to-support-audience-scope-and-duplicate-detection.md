---
id: NaN
title: 'Frontend: Update file upload to support audience scope and duplicate detection'
status: todo
priority: high
labels:
  - frontend
  - file-management
  - cms
createdAt: '2026-01-13T17:54:44.956Z'
updatedAt: '2026-01-13T17:54:44.956Z'
timeSpent: 0
---
# Frontend: Update file upload to support audience scope and duplicate detection

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the frontend file upload flow to support the new backend features: 1) Compute SHA-256 content hash before upload, 2) Pass new fields to initiate-upload API (contentHash, purpose, audienceType, audienceId), 3) Handle isDuplicate response - skip upload if file already exists, 4) Use publicUrl from response when isDuplicate is true. Backend changes completed in task 39.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Compute SHA-256 hash of file content before initiating upload
- [ ] #2 Update initiate-upload API call to include contentHash, purpose, audienceType, audienceId
- [ ] #3 Handle isDuplicate=true response by skipping the actual file upload
- [ ] #4 Use publicUrl from response when file is a duplicate
- [ ] #5 Update post creation to pass correct audienceType based on post audience selection
<!-- AC:END -->

