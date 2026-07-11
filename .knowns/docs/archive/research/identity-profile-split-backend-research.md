---
title: Identity Profile Split Backend Research
description: Backend research for a dedicated identity/profile split hardening spec covering guardian, staff, current auth shape, and future student login support.
createdAt: '2026-07-01T01:33:45.682Z'
updatedAt: '2026-07-10T22:05:01.254Z'
tags:
  - research
  - identity
  - profile-split
  - guardian
  - staff
  - student
  - auth
  - backend-spec
  - archived
---

# Identity Profile Split Backend Research

## Purpose

Research the current backend identity/profile shape before writing a dedicated spec for an Identity/Profile Split. This builds on @doc/archive/research/parent-multi-campus-existing-account-backend-research and @doc/specs/2026-07-01/parent-multi-campus-existing-account, but broadens the scope from parent guardian attach to global identity lifecycle, staff profiles, and future student-login support.

## Executive Findings

A separate spec is needed. The parent multi-campus spec can be the first use case, but the backend currently mixes global identity lifecycle with campus profile lifecycle in several places. If we only patch guardian attach, staff and future student login will inherit inconsistent behavior.

Staff is affected directly, and more heavily than guardian. Staff profiles already link to `User`, but StaffType default roles write `UserRole` grants. Today archiving a staff profile locks/deactivates the whole identity, so stale campus role grants do not matter much. In a split model where identity remains active, staff profile archive must also define how campus access and staff-type-derived role grants are disabled or ignored.

Future student login is not cleanly supported today. `Student` has no `userId` relation, `UserProfile` and `/auth/me` only support `guardian | staff`, but `CreateStudentUseCase` and `CreateStudentRequest` still expose `createUserAccount` and create a Clerk/internal `User` with no link back to the student. The spec should either disable that flag until a student-login spec exists or add an explicit nullable student identity relation and auth/profile semantics.

Recommended architecture follows the common large-system split:

- `User` is the global login identity and identity-provider binding.
- Guardian, Staff, and future Student are campus-scoped profiles/memberships.
- Roles are campus authorization, not proof that a specific profile is active unless guards or role grants enforce that explicitly.
- Archive is profile-local by default and should remove that profile's campus access.
- Identity lock/delete is a separate global privileged operation, not a side effect of normal campus profile archive/delete.

## Current Backend Reality

### Schema Supports Guardian/Staff Split, Not Student

`User` is global and stores `clerkUid`, `isActive`, `guardians`, `staffs`, and `userRoles` (`prisma/schema.prisma:229`). The schema comment already says a user can have Guardian and/or Staff profiles at multiple campuses (`prisma/schema.prisma:234`).

`Staff` has optional `userId`, relation to `User`, and `@@unique([campusId, userId])` (`prisma/schema.prisma:387`). `Guardian` has the same shape (`prisma/schema.prisma:429`). This permits one identity to own one staff profile and one guardian profile per campus, and multiple profiles across campuses.

`Student` has no `userId` relation and no `User.students[]` inverse relation (`prisma/schema.prisma:316`). Student identity is therefore not represented in the data model.

### Auth Projects One Profile, Not A Profile Set

`RequestContext.getUser()` loads the internal user by Clerk UID (`src/infra/http/context/request-context.service.ts:177`) and does not reject `user.isActive === false` before returning the user (`src/infra/http/context/request-context.service.ts:211`). Runtime blocking is currently mostly dependent on Clerk lock and role access, not a database active-state check.

`PrismaUserRepository` includes only one active guardian and one active staff profile for `/auth/me` (`src/infra/persistence/prisma/repositories/prisma-user.repository.ts:18`). `PrismaUserMapper` then chooses a single profile, preferring the first staff row over the first guardian row (`src/infra/persistence/prisma/mapper/prisma-user.mapper.ts:88`). The domain `UserProfile` union only allows `guardian | staff` (`src/domain/user-management/user.entity.ts:18`), and `AuthMeResponse` mirrors that single profile shape (`src/infra/http/dtos/auth/auth-me.response.ts:9`).

This is okay for simple display, but it is not a clean shared-identity model. A user with multiple active profiles has most profiles hidden from `/auth/me`, and staff-vs-guardian selection is implicit.

### Campus Guards Use Roles, Not Active Staff Profiles

`CampusGuard` checks campus access through `hasCampusAccess(fullUser, campusId)` (`src/infra/http/guards/campus.guard.ts:138`). `hasCampusAccess` returns true when the user has any applicable global or campus role (`src/infra/http/context/campus-context.ts:58`). `PermissionsGuard` then uses roles for the selected campus (`src/infra/http/guards/permissions.guard.ts:67`). Neither path checks whether the user still has an active staff profile in that campus.

Parent self-service is different and better aligned with the split: `GET /guardians/me/campuses` uses active guardian profiles, and absence-request guardian resolution uses `GuardianRepository.findByUserIdInCampus(userId, campusId)`. That pattern should inform profile-aware access.

### Identity Port Is Lifecycle-Oriented, Not Resolution-Oriented

`IdentityPort` can provision, update, invite, delete, lock, and unlock identities (`src/application/ports/identity.port.ts:50`). It cannot look up identity-provider users by email/phone or classify existing-provider conflicts. Any attach/reuse spec needs identity resolution APIs, not only provisioning.

## Guardian Profile Findings

Guardian create always provisions a new Clerk identity and creates a new internal `User` before creating the campus guardian profile (`src/application/user-management/use-cases/guardian/create-guardian.use-case.ts:67`). Existing parent attach therefore needs a new path or a refactor branch that can link a guardian profile to an existing `User` without Clerk provisioning.

Guardian update syncs profile email, phone, and fullName into Clerk when `guardian.userId` exists (`src/application/user-management/use-cases/guardian/update-guardian.use-case.ts:156`). In a shared identity model, normal campus profile edits should not silently change global login identifiers or shared public metadata.

Guardian archive/restore lock/unlock Clerk and deactivate/activate the internal `User` (`src/application/user-management/use-cases/guardian/archive-guardian.use-case.ts:68`, `src/application/user-management/use-cases/guardian/restore-guardian.use-case.ts:77`). Hard delete deletes the global Clerk/internal identity before deleting the guardian (`src/application/user-management/use-cases/guardian/delete-guardian.use-case.ts:37`). These are unsafe when the identity still has another active guardian/staff profile.

## Staff Profile Findings

Staff create always provisions a Clerk identity, creates `User`, creates `Staff`, writes StaffType join rows, and grants StaffType default roles to `UserRole` (`src/application/user-management/use-cases/staff/create-staff.use-case.ts:94`, `src/application/user-management/use-cases/staff/create-staff.use-case.ts:158`).

Staff update syncs email, phone, and fullName into Clerk when `staff.userId` exists (`src/application/user-management/use-cases/staff/update-staff.use-case.ts:329`). It also maintains StaffType-derived `UserRole` grants when staff types change (`src/application/user-management/use-cases/staff/update-staff.use-case.ts:517`).

Staff archive/restore lock/unlock Clerk and flip `User.isActive` (`src/application/user-management/use-cases/staff/archive-staff.use-case.ts:68`, `src/application/user-management/use-cases/staff/restore-staff.use-case.ts:77`). Staff hard delete deletes the linked identity (`src/application/user-management/use-cases/staff/delete-staff.use-case.ts:48`).

Staff repository has `findByUserId(userId)` but no `findByUserIdInCampus` or active-campus discovery equivalent to guardian (`src/application/user-management/ports/staff.repository.ts:46`). For shared staff identities, the backend needs campus-specific staff profile resolution.

Important staff-specific gap: if archive becomes profile-local and no longer locks/deactivates the identity, existing role grants can continue to pass `CampusGuard` and `PermissionsGuard` unless the implementation either revokes/marks inactive campus grants for archived staff profiles or makes guards require an active campus staff membership. This needs to be explicit in the spec.

## Student Login Findings

Student is profile-only in the schema and domain entity. `StudentProps` has no `userId` (`src/domain/user-management/entities/student.entity.ts:18`), and the response DTO does not expose a user link (`src/infra/http/dtos/user-management/student/student.response.ts:28`).

However, `CreateStudentRequest` exposes `createUserAccount` (`src/infra/http/dtos/user-management/student/create-student.request.ts:101`), and `CreateStudentUseCase` provisions Clerk and calls `tx.createUser` when that flag is true (`src/application/user-management/use-cases/student/create-student.use-case.ts:93`, `src/application/user-management/use-cases/student/create-student.use-case.ts:118`). Because no `Student.userId` exists, the created user is not connected to the student profile. Tests currently lock in this behavior (`src/application/user-management/use-cases/student/create-student.use-case.spec.ts:125`).

A dedicated spec should not ignore this. Either:

- disable/remove `createUserAccount` for students until student login is designed, or
- add `Student.userId?`, `User.students[]`, `@@unique([campusId, userId])`, `UserProfile.type = "student"`, and student-specific access semantics.

For now, the safer scope is to disable the broken student account creation path and reserve the data-model extension for a future student-login spec.

## Danger And Global Identity Operations

Danger controllers for guardian/staff hard delete are documented as deleting the profile, user account, and Clerk identity (`src/infra/http/controllers/danger/danger-guardian.controller.ts:34`, `src/infra/http/controllers/danger/danger-staff.controller.ts:34`). They use Clerk auth and campus access, but the methods read do not apply `PermissionsGuard` or a super-admin/system-role-only guard.

For the split spec, identity lock/delete should be modeled as global account operations with strict authorization. Normal campus profile archive should not lock/delete a shared identity. Hard delete should either preserve the identity when other profiles remain or refuse unless a global identity-delete operation is explicitly requested by an authorized super admin.

## Recommended Spec Shape

Create a dedicated spec, likely `specs/2026-07-01/identity-profile-split-hardening`, before implementation.

Core decisions to lock:

- D1: `User` is the global identity; Guardian/Staff/Student are campus profiles. Profile archive is local; identity lock/delete is global and super-admin-only.
- D2: Normal profile edits are campus-local. Email/phone/global identity changes are blocked for shared identities until a dedicated verified identity-change flow exists.
- D3: `/auth/me` either remains backward-compatible with single `profile` plus adds `profiles[]`, or it stays unchanged and profile discovery gets dedicated endpoints. Do not keep relying on implicit first-staff-wins selection for shared identities.
- D4: Staff campus access must require an active staff profile/membership or profile-aware active grants. Existing `UserRole` checks alone are not enough once `User.isActive` is no longer used as a per-profile gate.
- D5: Staff profile archive must disable StaffType-derived campus access. The spec must choose between revoking/restoring derived grants, marking grants inactive, or adding membership-aware guard checks.
- D6: Hard delete and lock/unlock require explicit global permission/system role and must check for other active profiles before touching identity-provider state.
- D7: Student account creation is currently incomplete. V1 should disable it unless student identity linking is included in scope.
- D8: Identity resolution/attach logic should be reusable across guardian and staff instead of embedded only in guardian create-or-attach.

Suggested implementation seams:

- Add an identity resolution service/use case that can classify internal matches and identity-provider conflicts by normalized email/phone.
- Add profile-count/profile-resolution repository methods for Guardian and Staff, and optionally future Student.
- Add a profile lifecycle service that can answer whether a `User` has any remaining active login-capable profile.
- Add tests that prove profile archive removes campus access without locking shared identity.
- Add tests that prove a shared staff+guardian identity can still use the remaining active profile after one profile is archived.
- Add tests that prove danger routes require global permission/system role before identity lock/delete.

## Spec Warning

The biggest backend risk is not guardian attach itself. It is leaving authorization tied only to `UserRole` while changing archive from global identity deactivation to profile-local archive. If that is not addressed, an archived staff profile could still retain campus permissions through existing `UserRole` rows.
