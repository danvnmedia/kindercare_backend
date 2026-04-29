---
id: lp2hd5
title: PATCH student-guardian relationship — backend core (use case + repo)
status: done
priority: medium
labels:
  - from-spec
  - student-guardian
  - backend-core
createdAt: '2026-04-18T01:34:24.203Z'
updatedAt: '2026-04-18T16:22:06.634Z'
timeSpent: 50628
spec: specs/patch-student-guardian-relationship
fulfills:
  - AC-4
  - AC-5
  - AC-6
  - AC-7
  - AC-8
  - AC-9
  - AC-10
  - AC-11
---
# PATCH student-guardian relationship — backend core (use case + repo)

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add updateGuardianRelationship to StudentRepository port and Prisma impl (using composite studentId_guardianId unique key). Create UpdateStudentGuardianRelationshipUseCase with ordered validation: relationshipType exists + not archived -> student exists + in header campus -> guardian exists + in header campus -> link row exists, then update. Create UpdateStudentGuardianRequest DTO and update mock repo factory. Ship unit tests covering all 6 scenarios.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Abstract updateGuardianRelationship(studentId, guardianId, relationshipId): Promise<void> added to StudentRepository port
- [x] #2 PrismaStudentRepository implements it via prisma.guardianStudent.update({ where: { studentId_guardianId: {...} }, data: { guardianRelationshipId } })
- [x] #3 UpdateStudentGuardianRelationshipUseCase performs ordered checks: relationshipType findById + archived check, student findById + campus match, guardian findById + campus match, link existence via getStudentGuardians, then repo update
- [x] #4 UpdateStudentGuardianRequest DTO has one field relationshipId with @IsUUID('4') validator; no campusId in body
- [x] #5 createMockStudentRepository in src/test-utils/mock-repository-factory.ts exposes updateGuardianRelationship: jest.fn()
- [x] #6 Unit tests cover: happy path returns DTO, link-not-found 404, student-not-in-campus 404, guardian-not-in-campus 404, relationshipId-not-found 404, archived-relationship 400, same-id no-op returns 200 with unchanged DTO
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Port** (`src/application/user-management/ports/student.repository.ts`) — add abstract `updateGuardianRelationship(studentId, guardianId, relationshipId): Promise<void>`. Fulfills AC-1.

2. **Prisma impl** (`src/infra/persistence/prisma/repositories/prisma-student.repository.ts`) — implement via `prisma.guardianStudent.update({ where: { studentId_guardianId: { studentId, guardianId } }, data: { guardianRelationshipId: relationshipId } })`. Relies on schema's `@@id([studentId, guardianId])`. Fulfills AC-2.

3. **Request DTO** (`src/infra/http/dtos/user-management/student/update-student-guardian.request.ts`, new) — single field `relationshipId` with `@IsUUID('4')` + `@IsNotEmpty()` + Swagger `@ApiProperty`. Mirrors shape of `link-student-guardian.request.ts` minus `guardianId`. Fulfills AC-4.

4. **Use case** (`src/application/user-management/use-cases/student/update-student-guardian-relationship.use-case.ts`, new) — inject STUDENT_REPOSITORY, GUARDIAN_REPOSITORY, GUARDIAN_RELATIONSHIP_TYPE_REPOSITORY. Input: `{ studentId, guardianId, campusId, relationshipId }`. Output: `{ studentId, guardianId, relationshipId, relationshipName }`. Ordered checks: (a) relationshipType.findById → 404 if missing, 400 if archived; (b) student.findById → 404 if missing OR student.campusId !== campusId; (c) guardian.findById → 404 if missing OR guardian.campusId !== campusId; (d) getStudentGuardians(studentId) → 404 if no matching guardianId; (e) call updateGuardianRelationship; (f) return DTO. Log start/success/failure per @doc/patterns/use-case-pattern. Fulfills AC-3.

5. **Test utils + inline-mock backfill** (fulfills AC-5):
   - `src/test-utils/mock-repository-factory.ts` — add `updateGuardianRelationship: jest.fn()` to `createMockStudentRepository`.
   - Backfill the new method into the 4 inline `jest.Mocked<StudentRepository>` constructions so the build stays clean: `archive-student.use-case.spec.ts`, `restore-student.use-case.spec.ts`, `enroll-student.use-case.spec.ts`, `cross-campus-prevention.integration.spec.ts`.

6. **Unit tests** (`src/application/user-management/use-cases/student/update-student-guardian-relationship.use-case.spec.ts`, new) — inline mocks for 3 injected repos (matches existing spec pattern in `archive-student.use-case.spec.ts`). 7 test cases: happy path returns DTO; link-not-found → 404; student-not-in-campus → 404; guardian-not-in-campus → 404; relationshipId-not-found → 404; archived-relationship → 400; same-id no-op → 200 with unchanged DTO. Fulfills AC-6.

7. **Build verification** — run `pnpm build` and `pnpm test -- update-student-guardian-relationship` to confirm TypeScript compile clean and all 7 tests green. Also re-run the 4 backfilled specs to ensure they still pass.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Step 6 done: wrote 7-case unit spec for UpdateStudentGuardianRelationshipUseCase (happy path, relationshipId-not-found, archived, student-cross-campus, guardian-cross-campus, link-not-found, same-id no-op). Step 7: npm test for new spec -> 7/7 green; re-ran 4 backfilled specs (archive/restore/enroll/cross-campus) -> 27/27 green; npm run build -> clean. All ACs satisfied.
<!-- SECTION:NOTES:END -->

