---
title: Identity Profile Split Hardening
description: Specification for hardening global identity versus campus profile lifecycle, staff access, auth profile projection, student account flag behavior, and super-admin identity operations.
createdAt: '2026-07-01T01:52:46.033Z'
updatedAt: '2026-07-01T02:24:27.969Z'
tags:
  - spec
  - approved
  - identity
  - profile-split
  - auth
  - staff
  - guardian
  - student
  - rbac
  - api
---

# Identity Profile Split Hardening

## Overview

Harden the backend around a clear split between global login identity and campus-scoped profiles.

`User` is the global authenticated identity bound to Clerk. `Staff` and `Guardian` are campus profiles/memberships. `Student` remains profile-only for V1. Normal campus profile archive, restore, and hard delete must not lock, unlock, deactivate, reactivate, or delete the global identity. Global identity lock/unlock/delete become explicit super-admin-only operations.

This spec intentionally covers lifecycle/auth hardening, not create-or-attach implementation. Guardian create-or-attach remains covered by @doc/specs/2026-07-01/parent-multi-campus-existing-account, and staff create-or-attach remains covered by @doc/specs/2026-07-01/staff-multi-campus-existing-account. Both create-or-attach specs should rely on the lifecycle semantics defined here.

Supporting research: @doc/research/identity-profile-split-backend-research.

## Locked Decisions

- D1: V1 keeps students profile-only. Student `createUserAccount` is disabled or removed from supported API behavior. Real student login (`Student.userId`, student auth profile, student access rules) is reserved for a future spec.
- D2: Archived staff cannot access that campus. Staff archive removes StaffType-derived role grants, restore recreates them, and staff/admin campus access must also require an active staff profile in that campus except for global super admins. Manual grants are not deleted, but they cannot bypass an archived staff profile.
- D3: Normal campus profile archive/restore never locks/unlocks Clerk or deactivates/reactivates the global `User`. It only affects the selected profile and profile-derived access. Identity lock/delete is a separate super-admin/global operation.
- D4: `/auth/me` replaces the single `profile` field with `profiles[]`, exposing all active staff/guardian profiles for the authenticated identity. This is a breaking response-shape change.
- D5: This spec covers lifecycle/auth hardening only. It does not implement guardian or staff create-or-attach. Guardian create-or-attach is covered by @doc/specs/2026-07-01/parent-multi-campus-existing-account, and staff create-or-attach is covered by @doc/specs/2026-07-01/staff-multi-campus-existing-account. Both specs depend on the lifecycle semantics defined here.
- D6: Email, phone, and fullName are global identity fields after account creation. Normal staff/guardian profile edit flows must not change them for linked profiles; changes require a separate future identity-change flow with verification/admin approval.
- D7: Danger hard-delete routes for staff/guardian become profile hard-delete only. They must not delete the linked Clerk/internal `User`; global identity delete is a separate super-admin identity operation.
- D8: This spec includes super-admin-only global identity lock/unlock and permanent identity delete. Lock/unlock affects Clerk and global `User.isActive` without archiving profiles. Permanent identity delete is separate from profile hard-delete and must be explicitly guarded.
- D9: Super-admin global identity delete is refused while any staff/guardian profile remains linked to that `User`, including archived profiles. Admin must hard-delete or explicitly unlink profiles first; this spec will not add implicit unlink/cascade behavior.

## Requirements

### Functional Requirements

- FR-1: Treat `User` as the global identity and `Staff`/`Guardian` as campus profiles in lifecycle behavior.
- FR-2: Update guardian archive so it only sets the selected `Guardian.isArchived = true` and records audit; it must not call Clerk lock and must not set `User.isActive = false`.
- FR-3: Update guardian restore so it only sets the selected `Guardian.isArchived = false` and records audit; it must not call Clerk unlock and must not set `User.isActive = true`.
- FR-4: Update staff archive so it sets the selected `Staff.isArchived = true`, removes StaffType-derived role grants for that staff profile's campus, and records audit in one transaction.
- FR-5: Update staff restore so it sets the selected `Staff.isArchived = false`, recreates StaffType-derived role grants from the active StaffType set, and records audit in one transaction.
- FR-6: Ensure archived staff cannot access staff/admin campus routes through manual campus grants. Global super admins with a global system role remain exempt.
- FR-7: Preserve manual `UserRole` grants during staff archive/restore, but do not allow manual grants to bypass the active staff profile requirement for staff/admin campus access.
- FR-8: Keep guardian parent self-service access profile-scoped: archived guardian profiles must not appear in guardian campus discovery and must not resolve for current-guardian student access.
- FR-9: Replace `/auth/me.profile` with `/auth/me.profiles[]` containing all active staff and guardian profiles linked to the authenticated `User`.
- FR-10: `/auth/me.profiles[]` must exclude archived profiles and must include enough campus/profile metadata for clients to choose context without relying on first-profile ordering.
- FR-11: Normal staff profile update must reject changes to email, phoneNumber, and fullName when the staff profile is linked to a `User`.
- FR-12: Normal guardian profile update must reject changes to email, phoneNumber, and fullName when the guardian profile is linked to a `User`.
- FR-13: Normal profile update may continue to edit non-identity fields such as address, dateOfBirth, gender, occupation, workAddress, StaffType set, and other non-global fields already supported by the relevant profile.
- FR-14: Staff/guardian hard-delete danger routes must delete only the selected campus profile and profile-local relations according to existing hard-delete semantics; they must not delete Clerk identity or internal `User`.
- FR-15: Add or expose super-admin-only global identity lock and unlock operations that lock/unlock Clerk and set `User.isActive` false/true without archiving or restoring any staff/guardian profile.
- FR-16: Add or expose super-admin-only global identity delete operation that deletes Clerk/internal `User` only when no `Staff` or `Guardian` profile, active or archived, remains linked to that `User`.
- FR-17: Global identity delete must refuse with a conflict when linked staff/guardian profiles exist; the response must be safe for super-admin troubleshooting and must not expose student/guardian relationship details beyond what is needed to resolve linked profiles.
- FR-18: Backend auth/authorization must reject inactive global users (`User.isActive = false`) even if a Clerk token still reaches the API.
- FR-19: Student create must no longer create an unlinked Clerk/internal `User`. Requests attempting `createUserAccount=true` must be rejected, ignored with an explicit response contract, or have the field removed from the request DTO. The chosen implementation must be observable and tested.
- FR-20: Existing student profile create/update/archive/restore/delete behavior remains profile-only and must not call Clerk or create/delete `User` records.
- FR-21: Audit events for profile archive/restore/hard-delete and global identity lock/unlock/delete must clearly distinguish profile lifecycle from global identity lifecycle.
- FR-22: The guardian and staff create-or-attach specs must use these lifecycle semantics: attach can link campus profiles to an existing `User`, normal profile archive/delete must not lock/delete the global identity, and staff archive must preserve manual grants while relying on the active staff profile gate for access denial.

### Non-Functional Requirements

- NFR-1: Security: global identity lock/unlock/delete must be available only to global super admins or an equivalent global system-role-only authorization path. Campus-scoped admins must not be able to perform global identity operations.
- NFR-2: Security: archived staff profiles must not retain campus access through stale role grants or manual grants.
- NFR-3: Privacy: `/auth/me.profiles[]` must not expose guardian child relationships, student details, or unrelated campus data.
- NFR-4: Backward compatibility: `/auth/me` response change is intentionally breaking and must be documented in response DTO/OpenAPI/tests.
- NFR-5: Reliability: profile lifecycle mutations that change profile state, StaffType-derived grants, and audit rows must be transactionally consistent.
- NFR-6: External identity safety: profile archive/restore/hard-delete must not call Clerk identity lock/unlock/delete APIs.
- NFR-7: Data integrity: identity delete must not leave linked staff/guardian profiles pointing at a deleted `User`.

## Acceptance Criteria

- [ ] AC-1: Archiving a linked guardian profile updates only that guardian profile and audit row; `IdentityPort.lockIdentity` is not called and `User.isActive` is unchanged.
- [ ] AC-2: Restoring a linked guardian profile updates only that guardian profile and audit row; `IdentityPort.unlockIdentity` is not called and `User.isActive` is unchanged.
- [ ] AC-3: Archiving a linked staff profile updates `Staff.isArchived`, removes StaffType-derived grants for that staff profile's campus, preserves manual grants, records audit, and does not call Clerk lock or deactivate `User`.
- [ ] AC-4: Restoring a linked staff profile recreates StaffType-derived grants from active StaffTypes, preserves manual grants, records audit, and does not call Clerk unlock or activate `User`.
- [ ] AC-5: A user with an archived staff profile and manual campus role cannot pass staff/admin campus access for that campus unless they are a global super admin.
- [ ] AC-6: A global super admin can still access campuses according to existing global system-role behavior even without an active staff profile in that campus.
- [ ] AC-7: Parent self-service campus discovery returns only campuses where the current user has an active guardian profile.
- [ ] AC-8: `/auth/me` returns `profiles[]` with all active staff/guardian profiles and no `profile` field in the new contract.
- [ ] AC-9: `/auth/me.profiles[]` excludes archived staff/guardian profiles and does not depend on first-staff-wins selection.
- [ ] AC-10: Updating email, phoneNumber, or fullName on a linked staff profile through normal staff update returns a validation/conflict error and does not call Clerk update.
- [ ] AC-11: Updating email, phoneNumber, or fullName on a linked guardian profile through normal guardian update returns a validation/conflict error and does not call Clerk update.
- [ ] AC-12: Updating non-identity fields on linked staff/guardian profiles still works and records the existing profile audit events.
- [ ] AC-13: `DELETE /danger/staff/:id` deletes only the staff profile and does not call Clerk delete or internal `UserRepository.delete` for the linked identity.
- [ ] AC-14: `DELETE /danger/guardians/:id` deletes only the guardian profile and does not call Clerk delete or internal `UserRepository.delete` for the linked identity.
- [ ] AC-15: Global identity lock is rejected for non-super-admin users and succeeds for a super admin by locking Clerk and setting `User.isActive = false` without archiving profiles.
- [ ] AC-16: Global identity unlock is rejected for non-super-admin users and succeeds for a super admin by unlocking Clerk and setting `User.isActive = true` without restoring profiles.
- [ ] AC-17: Inactive users (`User.isActive = false`) cannot access protected backend routes even if a Clerk-authenticated request reaches the API.
- [ ] AC-18: Global identity delete is rejected for non-super-admin users.
- [ ] AC-19: Global identity delete returns conflict when any linked Staff or Guardian profile exists, including archived profiles, and does not delete Clerk/internal `User`.
- [ ] AC-20: Global identity delete succeeds only when no Staff/Guardian profiles remain linked, deletes Clerk identity and internal `User`, and records an audit event where applicable.
- [ ] AC-21: Student create with `createUserAccount=true` no longer creates Clerk or internal `User`; the chosen API behavior is documented and covered by tests.
- [ ] AC-22: Student create/update/archive/restore/delete with normal profile-only inputs continues to pass existing behavior and does not call identity APIs.
- [ ] AC-23: OpenAPI/DTO tests reflect the `/auth/me` `profiles[]` contract and the student account creation flag behavior.
- [ ] AC-24: Regression tests cover a shared identity with both staff and guardian profiles where archiving one profile does not remove access through the other active profile.

## Scenarios

### Scenario 1: Guardian Archive Does Not Lock Shared Identity
**Given** a `User` has active guardian profiles in Campus A and Campus B
**When** Campus A staff archives the Campus A guardian profile
**Then** only the Campus A guardian profile is archived
**And** Clerk is not locked
**And** `User.isActive` remains true
**And** the guardian still discovers Campus B through parent campus discovery.

### Scenario 2: Staff Archive Removes Campus Access
**Given** a `User` has an active staff profile in Campus A with StaffType-derived grants and manual campus roles
**When** the staff profile is archived
**Then** StaffType-derived grants for that staff profile are removed
**And** manual grants are preserved
**But** the user cannot access staff/admin routes in Campus A because no active staff profile exists.

### Scenario 3: Staff Restore Recreates Derived Grants
**Given** an archived staff profile in Campus A still has active StaffTypes
**When** the staff profile is restored
**Then** the profile becomes active
**And** StaffType-derived grants are recreated for active StaffTypes
**And** staff/admin campus access is available again if role permissions allow it.

### Scenario 4: Global Super Admin Bypass
**Given** a global super admin has a global system role and no staff profile in Campus A
**When** they access Campus A staff/admin routes
**Then** the global system-role bypass still grants access according to existing global-admin semantics.

### Scenario 5: Auth Me Returns Multiple Profiles
**Given** a user has active staff and guardian profiles across multiple campuses
**When** they call `GET /auth/me`
**Then** the response includes all active profiles in `profiles[]`
**And** it does not include the old single `profile` field.

### Scenario 6: Linked Profile Identity Field Edit Is Rejected
**Given** a linked staff or guardian profile belongs to a `User`
**When** normal profile update attempts to change email, phoneNumber, or fullName
**Then** the request is rejected
**And** Clerk is not updated
**And** the profile's global identity fields remain unchanged.

### Scenario 7: Non-Identity Profile Edit Still Works
**Given** a linked guardian profile
**When** staff updates address, dateOfBirth, gender, occupation, or workAddress
**Then** the profile update succeeds
**And** no Clerk identity update occurs.

### Scenario 8: Danger Profile Delete Preserves Identity
**Given** a linked staff profile exists for a `User`
**When** a super-admin-authorized caller hard-deletes the staff profile through the danger profile route
**Then** the staff profile is deleted
**And** the linked Clerk/internal `User` remains.

### Scenario 9: Global Identity Lock
**Given** a global super admin targets an active `User`
**When** they lock the identity
**Then** Clerk identity is locked
**And** `User.isActive` becomes false
**And** Staff/Guardian profile archive flags are unchanged
**And** protected backend routes reject the locked user.

### Scenario 10: Global Identity Delete Refuses Linked Profiles
**Given** a `User` still has an archived guardian profile linked
**When** a global super admin attempts permanent identity delete
**Then** the operation returns conflict
**And** Clerk/internal `User` are not deleted.

### Scenario 11: Student Account Flag Is Disabled
**Given** staff creates a student with `createUserAccount=true`
**When** the request reaches the backend
**Then** no Clerk identity and no internal `User` are created
**And** the response/error matches the documented V1 contract.

## Technical Notes

- Current research details live in @doc/research/identity-profile-split-backend-research.
- Related parent/guardian attach spec: @doc/specs/2026-07-01/parent-multi-campus-existing-account.
- Related staff attach spec: @doc/specs/2026-07-01/staff-multi-campus-existing-account.
- Existing schema already supports `User` to many `Staff`/`Guardian` profiles through `@@unique([campusId, userId])`; `Student` has no identity link today.
- Current `/auth/me` mapper picks one profile and prefers staff. This must be replaced by an all-active-profiles projection.
- Current `RequestContext.getUserOrFail()` does not reject inactive users. This must be hardened for global lock to be meaningful server-side.
- Existing guardian parent access already uses active guardian profile resolution and should remain profile-scoped.
- Existing staff access is role-based; this spec requires an active staff-profile gate for staff/admin campus access except global super admins.
- StaffType-derived grant cleanup should use existing provenance (`grantedViaStaffTypeId`) where possible. Manual grants have null provenance and must not be deleted by staff archive/restore.
- Permanent identity delete must check linked profiles before deleting the `User`; this protects data integrity and avoids relying on relation `onDelete` behavior.
- Run this hardening before the parent/guardian and staff create-or-attach specs so attach flows build on stable shared lifecycle, `/auth/me.profiles[]`, identity-field blocking, and active staff profile access semantics.

## Task Links

- @task-9jhgfg [identity-profile-split-hardening-01] Harden auth identity projection and inactive-user enforcement
- @task-6vixzy [identity-profile-split-hardening-02] Make guardian lifecycle profile-scoped
- @task-ce906r [identity-profile-split-hardening-03] Make staff lifecycle profile-scoped and revoke derived access
- @task-bpzrmu [identity-profile-split-hardening-04] Enforce active staff profile gate for campus access
- @task-vj88pg [identity-profile-split-hardening-05] Block normal edits to linked identity fields
- @task-rezqjr [identity-profile-split-hardening-06] Make danger profile hard-delete profile-only
- @task-gmtu8s [identity-profile-split-hardening-07] Add super-admin global identity lock/unlock/delete
- @task-wc7tf2 [identity-profile-split-hardening-08] Disable unsupported student account creation
- @task-mylh8i [identity-profile-split-hardening-09] Add API contract and shared-identity regression coverage

## Open Questions

- [ ] Choose the exact API paths and DTO names for super-admin global identity lock/unlock/delete.
- [ ] Choose the exact error status/code for attempts to edit linked profile identity fields.
- [ ] Choose the exact V1 behavior for student `createUserAccount=true`: reject request vs ignore field with explicit warning/result.
- [ ] Confirm whether staff/admin active-profile gating should be centralized in `CampusGuard`, a new guard, or permission-specific route decorators during implementation planning.
