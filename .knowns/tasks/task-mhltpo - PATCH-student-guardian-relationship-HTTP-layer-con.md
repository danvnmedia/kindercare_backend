---
id: mhltpo
title: PATCH student-guardian relationship — HTTP layer (controllers + module)
status: done
priority: medium
labels:
  - from-spec
  - student-guardian
  - http-layer
createdAt: '2026-04-18T01:34:45.791Z'
updatedAt: '2026-04-18T17:18:05.218Z'
timeSpent: 3201
assignee: '@me'
spec: specs/patch-student-guardian-relationship
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-12
---
# PATCH student-guardian relationship — HTTP layer (controllers + module)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Expose two alias endpoints: PATCH /students/:studentId/guardians/:guardianId on StudentController and PATCH /guardians/:guardianId/students/:studentId on GuardianController. Both are thin adapters delegating to the shared UpdateStudentGuardianRelationshipUseCase (built in task lp2hd5). Register the use case in user-management.module.ts, add Swagger decorators matching neighboring POST/DELETE/GET endpoints, export the new request DTO from the student barrel.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 StudentController adds @Patch(':id/guardians/:guardianId') handler with @CampusContext(), @RequireCampusAccess(), ParseUUIDPipe on both UUID params, @StandardResponse({ type: LinkStudentGuardianResponse })
- [x] #2 GuardianController adds mirror @Patch(':id/students/:studentId') handler with identical guards and delegation
- [x] #3 Both handlers call the same UpdateStudentGuardianRelationshipUseCase instance
- [x] #4 UpdateStudentGuardianRelationshipUseCase registered in user-management.module.ts providers array
- [x] #5 UpdateStudentGuardianRequest exported from src/infra/http/dtos/user-management/student/index.ts
- [x] #6 Swagger decorators present on both endpoints: @ApiOperation, @ApiHeader(CAMPUS_ID_HEADER), @ApiParam for both UUIDs, @StandardResponse with success message
- [x] #7 Depends on task lp2hd5 being complete (use case must exist before controllers can inject it)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Module wiring** (`src/infra/http/modules/user-management.module.ts`) — import `UpdateStudentGuardianRelationshipUseCase` and add it to the providers array near `LinkStudentWithGuardianUseCase`/`UnlinkStudentFromGuardianUseCase`. Fulfills AC-4.

2. **DTO barrel** (`src/infra/http/dtos/user-management/student/index.ts`) — add `export * from "./update-student-guardian.request";`. Fulfills AC-5.

3. **StudentController handler** (`src/infra/http/controllers/user-management/student.controller.ts`) — inject `UpdateStudentGuardianRelationshipUseCase` in constructor. Add `@Patch(':id/guardians/:guardianId')` placed after the existing Delete handler. Decorators: `@RequireCampusAccess()`, `@StandardResponse({ message: 'Guardian relationship updated successfully', type: LinkStudentGuardianResponse })`, `@ApiOperation({ summary, description })`, `@ApiHeader({ name: 'x-campus-id', ... })` (matches this file's existing style), `@ApiParam` for both UUIDs. Signature: `(@CampusContext() campusId, @Param('id', ParseUUIDPipe) studentId, @Param('guardianId', ParseUUIDPipe) guardianId, @Body() dto: UpdateStudentGuardianRequest)`. Body delegates to `updateStudentGuardianRelationshipUseCase.execute({ studentId, guardianId, campusId, relationshipId: dto.relationshipId })`. Fulfills AC-1, AC-6 (student-side).

4. **GuardianController mirror** (`src/infra/http/controllers/user-management/guardian.controller.ts`) — inject the same `UpdateStudentGuardianRelationshipUseCase`. Add `@Patch(':id/students/:studentId')` placed after the existing `@Delete(':id/students/:studentId')` handler. Mirror decorators using `CAMPUS_ID_HEADER` constant (matches this file's existing style) and the same `LinkStudentGuardianResponse` response type. Signature: `(@CampusContext() campusId, @Param('id', ParseUUIDPipe) guardianId, @Param('studentId', ParseUUIDPipe) studentId, @Body() dto: UpdateStudentGuardianRequest)`. Delegates to the SAME use case instance with the same input (param order swapped at the URL, same at the application layer). Fulfills AC-2, AC-3, AC-6 (guardian-side).

5. **Build verification** — run `npm run build` to confirm TypeScript compile clean. Run `npm test` (full suite) to confirm no regression in the 4 backfilled specs or any other test. No new tests required by this task's ACs (AC-11 is already satisfied by the use-case unit tests shipped in lp2hd5).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Done: (1) wired UpdateStudentGuardianRelationshipUseCase into user-management.module providers; (2) added update-student-guardian.request to student DTO barrel; (3) StudentController: injected use case, added @Patch(':id/guardians/:guardianId') with x-campus-id ApiHeader, dual @ApiParam UUIDs, StandardResponse(LinkStudentGuardianResponse); (4) GuardianController: mirror @Patch(':id/students/:studentId') using CAMPUS_ID_HEADER constant (matches file style), same shared use case, same DTO. Both handlers delegate to one UpdateStudentGuardianRelationshipUseCase instance with { studentId, guardianId, campusId, relationshipId }. Build: npm run build -> clean. Tests: npm test -> 472/472 pass across 30 suites.
<!-- SECTION:NOTES:END -->

