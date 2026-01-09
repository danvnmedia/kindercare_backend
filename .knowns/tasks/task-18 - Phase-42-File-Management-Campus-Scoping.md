---
id: '18'
title: 'Phase 4.2: File Management Campus Scoping'
status: todo
priority: medium
labels:
  - domain
  - file
  - campus-scoping
  - phase-4
createdAt: '2026-01-06T04:30:42.907Z'
updatedAt: '2026-01-06T04:30:42.907Z'
timeSpent: 0
---
# Phase 4.2: File Management Campus Scoping

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update File entity and file management for campus scoping.

Depends on @task-8 (Schema), @task-9 (Campus module).
See @doc/migrations/multi-campus-migration for context.

## Changes Required

### Domain Layer
**File**: src/domain/file-management/entities/file.entity.ts
- Add: campusId property (required)
- Files are isolated to the campus they were uploaded in

### Application Layer

**Port Update**: src/application/file-management/ports/file.repository.ts
- Add: findByCampusId(campusId, params)
- Update: findAll to filter by campusId

**Use Case Updates**:
- upload-file.use-case.ts (initiate-upload)
  - Require campusId
  - Associate file with campus
  
- complete-upload.use-case.ts
  - Verify campus access
  
- get-file.use-case.ts
  - Verify file belongs to user's campus
  
- delete-file.use-case.ts
  - Verify campus access

### Infrastructure Layer

**Repository**: prisma-file.repository.ts
- Update for campus filtering
- Include campus in queries

**Mapper**: prisma-file.mapper.ts
- Add campusId mapping

### HTTP Layer

**Controller**: file.controller.ts
- Get campusId from auth context
- Pass campusId to use cases
- Ensure file operations are campus-scoped

**DTOs**:
- initiate-upload.request.ts - Add campusId (optional if from context)
- file.response.ts - Add campusId

## Storage Considerations
- File storage keys may need campus prefix for isolation
- Consider: /{campus_id}/{year}/{month}/{file_id}
- This is optional but recommended for large deployments
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 File entity has campusId property
- [ ] #2 File repository updated for campus filtering
- [ ] #3 Upload-file requires campusId
- [ ] #4 Get-file verifies campus access
- [ ] #5 Delete-file verifies campus access
- [ ] #6 Mapper updated with campusId
- [ ] #7 DTOs include campusId
- [ ] #8 File controller scoped to campus
- [ ] #9 Files isolated to uploading campus
- [ ] #10 Tests updated
<!-- AC:END -->

