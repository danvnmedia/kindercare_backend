---
title: Parent Multi-Campus Existing Account Backend Research
description: Backend research and spec-shaping notes for supporting one parent identity across multiple campus-scoped guardian profiles.
createdAt: '2026-06-30T23:24:32.228Z'
updatedAt: '2026-06-30T23:24:32.228Z'
tags:
  - research
  - parent-access
  - multi-campus
  - guardian
  - identity
  - backend-spec
---

# Parent Multi-Campus Existing Account Backend Research

## Purpose

Backend research for shaping the spec from @doc/frontend-handoff/parent-multi-campus-existing-account-frontend-handoff. The frontend handoff is useful, but several behaviors must be corrected against backend architecture and current implementation.

Related context:
- @doc/frontend-handoff/parent-multi-campus-existing-account-frontend-handoff
- @doc/specs/2026-06-28/parent-access-model-and-campus-discovery
- @doc/patterns/guards-pattern#parent-self-service-relationship-access
- @doc/architecture/multi-campus-architecture
- @doc/architecture/rbac-system#cross-campus-considerations

## Current Backend Reality

### Parent runtime access already supports multi-campus profiles

`GET /guardians/me/campuses` is implemented and backed by `GuardianRepository.findActiveCampusesByUserId(userId)`. It returns non-archived campuses where the current authenticated domain `User` has a non-archived `Guardian` profile. Parent self-service student access resolves the current guardian by `currentUser.id + campusId` and then reads active children in that campus.

Reusable files:
- `src/infra/http/controllers/user-management/guardian.controller.ts`
- `src/application/user-management/use-cases/guardian/get-current-guardian-campuses.use-case.ts`
- `src/application/absence-request/use-cases/guardian-resolution.ts`
- `src/application/absence-request/use-cases/get-current-guardian-students.use-case.ts`
- `src/infra/persistence/prisma/repositories/prisma-guardian.repository.ts`

### Schema supports one User across multiple campus guardian profiles

The Prisma schema says `User` can have many `Guardian` profiles, and `Guardian` is unique by `[campusId, userId]`, not globally by `userId`. This is the right foundation for one login across campuses.

Relevant schema facts:
- `User.guardians Guardian[]`
- `Guardian.userId String?`
- `Guardian @@unique([campusId, email])`
- `Guardian @@unique([campusId, phoneNumber])`
- `Guardian @@unique([campusId, userId])`

### Current guardian create does not reuse identities

`CreateGuardianUseCase` validates campus-scoped guardian uniqueness, then always calls `identityPort.provisionUser`, creates a new internal `User`, and creates the `Guardian` linked to that new user. `IdentityService.provisionUser` explicitly rejects existing Clerk email or phone. Therefore the current `POST /guardians` cannot attach an existing parent account from another campus.

Reusable pieces:
- campus-scoped duplicate checks on guardian email and phone
- UoW create of `User` and `Guardian`
- audit event recording in the same transaction
- Clerk compensation pattern when DB/audit fails after external provision

Missing pieces:
- privacy-safe identity resolution by email/phone
- ability to classify no match, eligible match, ambiguous match, identifier mismatch, same-campus existing, archived profile
- response metadata for created vs attached vs restored
- tests for cross-campus attach and existing-account conflicts

### Identity lookup is not exposed through the port

`IdentityPort` currently supports provision/update/delete/invite/lock/unlock only. It has no lookup method for resolving existing Clerk users by email or phone. `UserRepository.findByEmail` can find internal users through existing Guardian/Staff profiles, but it is not enough to prove Clerk global uniqueness or resolve Clerk-only conflicts.

Spec should either:
- add identity lookup methods to `IdentityPort`, returning a minimal internal-safe identity match shape; or
- perform resolution strictly through internal `User`/profile repositories and treat Clerk conflicts without a matching domain `User` as manual-review identity-provider conflicts.

### Date of birth is not required by backend create

The frontend handoff says the current UI requires date of birth. Backend DTO and use case treat `dateOfBirth` as optional, but validate 18+ when present. The backend spec should not make date of birth required unless product explicitly wants to change backend behavior.

### Archive, restore, and hard delete currently assume one profile owns one identity

`ArchiveGuardianUseCase` locks the Clerk identity and sets `User.isActive = false` whenever the guardian has a user account. `RestoreGuardianUseCase` unlocks and activates the user. `DeleteGuardianUseCase` deletes the Clerk identity and internal user before deleting the guardian.

This becomes unsafe once a user can have active guardian profiles in other campuses or a staff profile. The spec must define shared-user semantics before enabling attach.

Recommended behavior:
- archive only the campus guardian profile by default
- deactivate/lock a `User` only when there are no remaining active profiles requiring the login
- restore/reactivate/unlock only when restoring from an all-inactive state
- hard delete must refuse or preserve shared `User`/Clerk identity while other profiles exist

### Guardian profile update has global identity side effects

`UpdateGuardianUseCase` syncs email, phone, and full name to Clerk when the guardian has a `userId`. With shared identities, editing those fields from one campus profile changes global identity state but only updates one Guardian row. The spec must define whether email/phone/fullName are profile-local, identity-global, or restricted when `userId` is shared.

Conservative v1 recommendation: do not broaden profile update behavior in this spec. For shared identities, either block email/phone changes with a clear conflict/manual-review error or define a separate global identity update flow.

### Guardian-student relationship link paths need stronger same-campus enforcement

`POST /guardians/:id/students` receives campus context but does not pass it into `LinkStudentToGuardianUseCase`; the use case checks existence and duplicates but not that guardian, student, and relationship type share the selected campus. The student-side link use case has the same issue. Relationship update validates student and guardian campus but not relationship type campus.

Spec should require:
- pass `campusId` into guardian-side and student-side link/unlink use cases
- verify `student.campusId === campusId`
- verify `guardian.campusId === campusId`
- verify `relationshipType.campusId === campusId`
- hide cross-campus existence consistently, using existing 404-style patterns where applicable

## Recommended Spec Shape

### Endpoint strategy

Prefer a dedicated staff endpoint for this feature instead of silently changing existing create semantics:

`POST /guardians/create-or-attach`

Rationale: attaching an existing identity is materially different from creating a brand-new guardian account, has privacy-sensitive states, and needs stable result metadata. The current `POST /guardians` can remain strict/backward-compatible until frontend switches to the new flow.

If product wants the smallest frontend change, the existing `POST /guardians` can delegate to the new use case, but the spec should call out the response-shape change and compatibility risk.

### Matching policy

Conservative v1 matching policy:
- use staff campus authorization from normal `@RequireCampusAccess()`
- first check same-campus email/phone/profile conflicts
- resolve existing identity by normalized email and phone
- attach only when email and phone resolve to exactly one same internal `User`
- if email and phone resolve to different users, return stable mismatch/ambiguous status
- if Clerk reports existing identity but no matching internal `User`, return identity-provider conflict/manual review
- never expose other-campus students, guardian relationships, or campus list to staff during lookup/attach

### Create-or-attach outcomes

Recommended machine statuses:
- `CREATED_NEW_ACCOUNT`
- `ATTACHED_EXISTING_ACCOUNT`
- `RESTORED_EXISTING_GUARDIAN`
- `ALREADY_EXISTS_IN_CAMPUS`
- `IDENTITY_IDENTIFIER_MISMATCH`
- `AMBIGUOUS_IDENTITY_MATCH`
- `IDENTITY_PROVIDER_CONFLICT`
- `SHARED_IDENTITY_UPDATE_RESTRICTED`

Success response should include the selected-campus `Guardian` plus a stable result status. Avoid exposing cross-campus details unless product explicitly approves.

### Audit

Keep same-transaction audit for DB-side writes. Create-or-attach should record enough context to distinguish new identity vs existing identity attach without logging private cross-campus details. Consider a new action such as `ATTACH_EXISTING_GUARDIAN_IDENTITY`, or keep `CREATE_GUARDIAN` with a result-status context field if the audit taxonomy should stay small.

### Tests to require

Use focused unit and repository tests similar to existing guardian/staff specs:
- new account path provisions Clerk, creates User + Guardian, emits audit, compensates Clerk on DB/audit failure
- cross-campus existing parent path creates Guardian with existing `userId`, does not provision Clerk, emits attach audit/status
- same-campus active duplicate returns stable duplicate/already-exists behavior
- same-campus archived profile behavior is explicit and tested
- email/phone mismatch and ambiguous global matches return stable errors/statuses
- Clerk existing identity with no internal user returns identity-provider conflict/manual review
- archive/restore/hard-delete do not lock/delete shared identity when other active profiles remain
- relationship link/unlink/update reject cross-campus guardian/student/relationship type combinations
- parent campus discovery still returns only active campuses for the authenticated user after attach

## Spec Warnings

- Do not conflate staff RBAC campus access with parent runtime access. Staff attach/create remains RBAC-governed; parent discovery/self-service remains relationship-governed.
- Do not trust client-provided `userId` or `guardianId` for parent self-service access.
- Do not expose cross-campus private data through lookup/attach responses.
- Do not leave lock/delete semantics unchanged after enabling shared identities.
- Avoid using global `findFirst` email/phone repository methods for identity matching because they cannot distinguish ambiguous matches.
