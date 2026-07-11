---
title: Staff Multi-Campus Existing Account
description: Specification for creating or attaching campus-scoped staff profiles to one shared staff identity across multiple campuses with RBAC-safe lifecycle behavior.
createdAt: '2026-07-01T02:02:29.691Z'
updatedAt: '2026-07-10T22:05:03.180Z'
tags:
  - spec
  - approved
  - staff
  - multi-campus
  - identity
  - rbac
  - api
---

# Staff Multi-Campus Existing Account

## Overview

Support one authenticated identity being used as staff in multiple campuses. Staff admins need a safe way to create a new staff login or attach an existing internal identity to a new campus-specific staff profile without duplicating Clerk accounts, leaking cross-campus profile details, or leaving archived staff with campus access.

This spec is separate from `@doc/specs/2026-07-01/parent-multi-campus-existing-account` because staff access is RBAC-based and StaffType membership creates campus-scoped role grants. It uses `@doc/archive/research/staff-multi-campus-existing-account-backend-research` as supporting backend context.

## Locked Decisions

- D1: Add a dedicated `POST /staff/create-or-attach` endpoint. Keep existing `POST /staff` as create-new only.
- D2: Attach only when normalized email and phone both resolve to exactly the same existing internal `User`. One-sided matches, split matches, and ambiguous matches are rejected.
- D3: If the matched `User` already has an active staff profile in the target campus, return it with `ALREADY_EXISTS_IN_CAMPUS`; if the target-campus profile is archived, restore it.
- D4: Archiving a staff profile must remove that staff profile's StaffType-derived target-campus access and must make staff/admin campus access fail unless the identity is a global super admin.
- D5: Staff archive removes StaffType-derived role grants for the target campus and preserves manual grants. Staff restore re-applies StaffType-derived default-role grants only. Manual grants are not deleted by archive/restore, but they cannot bypass the active staff profile requirement while the staff profile is archived.
- D6: Normal staff archive is profile/campus-scoped only. Identity lock/delete is global and super-admin-only.
- D7: Staff `email`, `phoneNumber`, and `fullName` are shared identity fields, not campus-local staff profile fields.
- D8: Staff `email`, `phoneNumber`, and `fullName` can be changed only through a future verified/admin global identity-change flow. Normal campus staff profile updates must not mutate them.
- D9: `/auth/me` exposes the authenticated identity and full active profile set for bootstrap/profile context, but staff campus discovery and the staff campus picker remain RBAC-based through `GET /campuses`. Backward compatibility with the current single implicit `profile` shape is not required. Staff/admin campus authorization must still respect the active staff profile gate defined by @doc/specs/2026-07-01/identity-profile-split-hardening.
- D10: This spec does not add a global identity-field update flow. Super-admin identity lock/unlock/delete and normal profile identity-field blocking are covered by @doc/specs/2026-07-01/identity-profile-split-hardening; email/phone/fullName correction is reserved for a future verified/admin identity-change flow.
- D11: `POST /staff/create-or-attach` returns 2xx success responses with `resultStatus` and target-campus staff data only. It must not expose cross-campus staff, guardian, child, role, or campus details beyond what is already authorized for the request.
- D12: Attaching an existing staff identity grants only the target-campus StaffType default roles. Existing campus role grants are not copied or changed.
- D13: `POST /staff/create-or-attach` can attach a staff profile to any matching internal `User`, including a guardian-only identity.

## Requirements

### Functional Requirements

- FR-1: The backend must expose `POST /staff/create-or-attach` for staff admins with target campus context.
- FR-2: The existing `POST /staff` behavior must remain create-new only and must not silently attach existing identities.
- FR-3: `POST /staff/create-or-attach` must accept the staff creation inputs needed to create a target-campus staff profile, including `fullName`, `email`, `phoneNumber`, `staffTypeIds`, and existing optional staff profile fields.
- FR-4: When no existing internal identity or identity-provider conflict exists, `POST /staff/create-or-attach` must create a new Clerk identity, internal `User`, campus `Staff` profile, StaffType join rows, and target-campus StaffType default-role grants.
- FR-5: When email and phone both match the same internal `User`, `POST /staff/create-or-attach` must attach that `User` to a new target-campus `Staff` profile without provisioning another Clerk identity.
- FR-6: Attach must allow a matched internal `User` that currently has only guardian profiles and no staff profiles.
- FR-7: If email and phone do not resolve to the same internal `User`, the request must be rejected with a stable `409 Conflict` error code.
- FR-8: If Clerk or the identity provider has the requested email or phone but the backend cannot resolve that provider identity to an internal `User`, the request must be rejected with `IDENTITY_PROVIDER_CONFLICT` and require manual review.
- FR-9: Same-campus active staff profile matches must return success with `ALREADY_EXISTS_IN_CAMPUS` and must not create a new staff profile, new user, new Clerk identity, or duplicate role grants.
- FR-10: Same-campus archived staff profile matches must restore the target-campus staff profile and return success with `RESTORED_EXISTING_STAFF`.
- FR-11: Successful create-or-attach responses must include a `resultStatus` value and target-campus staff data only. Required success statuses are `CREATED_NEW_STAFF`, `ATTACHED_EXISTING_IDENTITY`, `ALREADY_EXISTS_IN_CAMPUS`, and `RESTORED_EXISTING_STAFF`.
- FR-12: Create-or-attach must validate every requested StaffType exists, is not archived, and belongs to the target campus before creating or attaching the staff profile.
- FR-13: Create-or-attach must grant only target-campus StaffType default roles for the attached/created staff profile. It must not copy roles from other campuses and must not mutate other campus grants.
- FR-14: Normal campus staff update endpoints must reject attempts to change `email`, `phoneNumber`, or `fullName` for linked staff profiles and must not sync those fields to Clerk.
- FR-15: This spec must not add a global identity-field update endpoint. Email, phone, and fullName correction remains reserved for a future verified/admin global identity-change flow.
- FR-16: Campus-scoped staff permissions in this spec must not authorize global identity-field mutation. Any future identity-change flow must require super-admin/global authority.
- FR-17: Normal staff archive must mark only the target-campus `Staff` profile archived and must not lock Clerk, delete Clerk, deactivate the global `User`, or delete the global `User`.
- FR-18: Staff archive must remove StaffType-derived role grants for the target campus, preserve manual grants, and rely on the active staff profile gate from @doc/specs/2026-07-01/identity-profile-split-hardening to prevent archived staff access.
- FR-19: Staff restore must unarchive only the target-campus `Staff` profile and re-apply StaffType-derived default-role grants for that profile's current StaffTypes. It must not create, copy, or restore manual grants automatically.
- FR-20: Staff profile hard delete must be profile-only. Global identity lock/delete remains a separate super-admin/global operation and must not be triggered by normal campus staff management.
- FR-21: `/auth/me` must expose the authenticated identity and all active profile records needed for bootstrap/profile context, including active staff profile metadata and campus references, instead of selecting one implicit staff profile.
- FR-22: Staff campus discovery and the staff campus picker must continue to use `GET /campuses`, which reflects RBAC-accessible campuses plus the active staff profile gate. V1 must not add a redundant `GET /staff/me/campuses` endpoint.
- FR-23: `/auth/me` must avoid returning archived staff profiles as active staff profiles.
- FR-24: Audit events must distinguish create-new staff, attach-existing staff identity, already-existing no-op, archived-profile restore, staff profile archive, and staff profile restore.

### Non-Functional Requirements

- NFR-1: Cross-campus privacy must be preserved. Target-campus staff admins must not receive other-campus staff profile details from create-or-attach responses.
- NFR-2: Identity and profile mutations must be transactionally safe. Backend database changes, StaffType joins, role grants, role revokes, and audit rows must not leave partial state on failure.
- NFR-3: Identity-provider calls must be compensated or ordered so failed database work does not leave accidental new identities when creating new staff.
- NFR-4: Authorization must remain least-privilege. Campus-scoped roles cannot perform global identity lock, delete, or identity-field mutation.
- NFR-5: Role grant and revoke behavior must be deterministic and test-covered for StaffType-derived grant cleanup, manual grant preservation, and active-profile access gating.
- NFR-6: Error responses must use stable machine-readable codes for frontend branching.

## Acceptance Criteria

- [ ] AC-1: Creating a brand-new staff account through `POST /staff/create-or-attach` provisions one Clerk identity, one internal `User`, one target-campus `Staff` profile, StaffType join rows, target-campus default-role grants, and returns `CREATED_NEW_STAFF`.
- [ ] AC-2: Attaching an existing internal staff identity to a new campus creates exactly one target-campus `Staff` profile, does not call Clerk create, grants only target-campus StaffType default roles, and returns `ATTACHED_EXISTING_IDENTITY`.
- [ ] AC-3: Attaching an existing guardian-only internal identity to a staff campus creates a staff profile on that same `User` and returns `ATTACHED_EXISTING_IDENTITY`.
- [ ] AC-4: Same-campus active staff matches return `ALREADY_EXISTS_IN_CAMPUS` without mutation audit, duplicate profile creation, Clerk creation, or duplicate role grants.
- [ ] AC-5: Same-campus archived staff matches restore the profile, re-apply current StaffType default-role grants, emit restore audit, and return `RESTORED_EXISTING_STAFF`.
- [ ] AC-6: Email-only, phone-only, and split email/phone matches all fail with `409 Conflict` and stable mismatch/ambiguous codes.
- [ ] AC-7: Identity-provider-only email or phone conflicts fail with `409 Conflict` and `IDENTITY_PROVIDER_CONFLICT`.
- [ ] AC-8: Successful create-or-attach responses include only target-campus staff data and do not expose other-campus profile, role, guardian, child, or campus details.
- [ ] AC-9: Archiving one campus staff profile removes StaffType-derived role grants for that profile's target campus, preserves manual grants, does not lock/deactivate/delete the global identity, and does not affect other campus staff access.
- [ ] AC-10: Restoring an archived staff profile re-applies StaffType-derived default-role grants for that profile's current StaffTypes, preserves manual grants, and does not create or copy manual grants automatically.
- [ ] AC-11: Campus staff update attempts to change `email`, `phoneNumber`, or `fullName` for a linked staff profile are rejected and do not update Clerk or sibling profile rows.
- [ ] AC-12: This spec does not add a global identity-field update endpoint; email, phone, and fullName correction remains reserved for a future verified/admin identity-change flow.
- [ ] AC-13: A non-super-admin or campus-scoped admin cannot mutate global identity fields through staff create-or-attach, normal staff update, or any campus-scoped staff permission in this spec.
- [ ] AC-14: `/auth/me` returns the active profile set defined by @doc/specs/2026-07-01/identity-profile-split-hardening, includes all active staff profile records for a multi-campus staff identity, excludes archived staff profiles from the active profile set, and does not replace `GET /campuses` as the RBAC staff campus picker/discovery API.
- [ ] AC-15: `GET /campuses` remains the staff campus picker/discovery source and reflects accessible campuses after staff attach, archive, and restore through RBAC grants plus the active staff profile gate.
- [ ] AC-16: Existing `POST /staff` tests continue to prove that endpoint is create-new only and does not attach existing identities.

## Scenarios

### Scenario 1: Staff Admin Creates A New Staff Identity
**Given** a campus admin has access to Campus A and submits a new email and phone number
**When** they call `POST /staff/create-or-attach` with valid StaffTypes for Campus A
**Then** the backend creates a new identity, staff profile, StaffType joins, target-campus default-role grants, and returns `CREATED_NEW_STAFF`.

### Scenario 2: Staff Admin Attaches Existing Staff Identity To Another Campus
**Given** an internal `User` already has an active staff profile in Campus A
**And** the same normalized email and phone are submitted for Campus B
**When** an authorized Campus B admin calls `POST /staff/create-or-attach`
**Then** the backend creates a Campus B staff profile linked to the existing `User`, grants only Campus B StaffType default roles, and returns `ATTACHED_EXISTING_IDENTITY`.

### Scenario 3: Guardian-Only Identity Becomes Staff
**Given** an internal `User` has guardian profile(s) but no staff profile
**And** email and phone both match that internal `User`
**When** an authorized campus admin calls `POST /staff/create-or-attach`
**Then** the backend creates a staff profile linked to the existing guardian identity and does not create a second login.

### Scenario 4: Same-Campus Staff Already Exists
**Given** the matched `User` already has an active staff profile in the selected campus
**When** `POST /staff/create-or-attach` is called with the same identity fields
**Then** the backend returns `ALREADY_EXISTS_IN_CAMPUS` and does not mutate identity, staff, role, or audit state.

### Scenario 5: Same-Campus Staff Is Archived
**Given** the matched `User` has an archived staff profile in the selected campus
**When** `POST /staff/create-or-attach` is called
**Then** the backend restores that staff profile, re-applies current StaffType default-role grants, and returns `RESTORED_EXISTING_STAFF`.

### Scenario 6: Identifier Match Is Unsafe
**Given** email resolves to one internal `User` and phone resolves to another internal `User`
**When** `POST /staff/create-or-attach` is called
**Then** the backend rejects the request with `409 Conflict` and a stable ambiguous/mismatch code.

### Scenario 7: Provider Identity Exists Without Internal User
**Given** Clerk has the requested email or phone but the backend cannot map it to an internal `User`
**When** `POST /staff/create-or-attach` is called
**Then** the backend rejects with `409 Conflict` and `IDENTITY_PROVIDER_CONFLICT`.

### Scenario 8: Staff Archive Removes Campus Access Only
**Given** a shared staff identity has active staff profiles in Campus A and Campus B
**And** Campus A has StaffType-derived grants and may have manual grants
**When** the Campus A staff profile is archived
**Then** Campus A StaffType-derived grants for that profile are removed
**And** manual Campus A grants are preserved
**But** staff/admin access to Campus A fails because the identity no longer has an active Staff profile there
**And** Clerk remains unlocked, the global `User` remains active, and Campus B access remains intact.

### Scenario 9: Staff Restore Reapplies Configured Access
**Given** a Campus A staff profile was archived
**And** its StaffType-derived grants were removed while manual grants were preserved
**When** the profile is restored
**Then** StaffType-derived default roles for Campus A are granted based on the profile's current StaffTypes
**And** preserved manual grants can contribute to authorization again only because the Staff profile is active
**And** no manual grants are created, copied, or restored automatically.

### Scenario 10: Identity Field Changes Stay Out Of Scope
**Given** a linked staff identity has staff and/or guardian profiles in one or more campuses
**When** a campus-scoped staff workflow attempts to change `email`, `phoneNumber`, or `fullName`
**Then** the request is rejected and does not update Clerk or sibling profile rows
**And** any future identity-field correction must use a separate verified/admin global identity-change flow outside this spec.

### Scenario 11: Current User Shape And Staff Campus Picker Stay Separate
**Given** an authenticated identity has active staff profiles in Campus A and Campus B
**When** `/auth/me` is called
**Then** the response includes both active staff profile records and does not rely on a single implicit first staff profile
**And** when the frontend needs the staff campus picker, it uses `GET /campuses`, not a staff-specific campus discovery endpoint.

## Technical Notes

- Current backend research is in `@doc/archive/research/staff-multi-campus-existing-account-backend-research`.
- Shared identity/profile split context is in `@doc/archive/research/identity-profile-split-backend-research` and the canonical lifecycle/auth spec is @doc/specs/2026-07-01/identity-profile-split-hardening.
- Guardian matching and response decisions are in `@doc/specs/2026-07-01/parent-multi-campus-existing-account` and should be reused where the behavior is identity-generic.
- StaffType default-role and provenance constraints are covered by `@doc/specs/2026-06-27/staff-type-rbac-hardening` and `@doc/architecture/rbac-system`.
- Existing schema is capable of one `User` having many campus-scoped `Staff` profiles via `Staff.userId` plus `@@unique([campusId, userId])`.
- Current `StaffRepository.findByUserId(userId)` is not sufficient for shared identities because it returns one staff row; implementation needs campus-specific staff profile lookup.
- Current `/auth/me` reads only one active staff and one active guardian profile. The full active profile projection is owned by @doc/specs/2026-07-01/identity-profile-split-hardening and should be reused here.
- Staff campus picker/discovery remains `GET /campuses`. That endpoint and RBAC guards remain the source of truth for staff campus access, but staff/admin campus authorization must also require an active Staff profile except for global super admins.
- Staff archive removes StaffType-derived target-campus grants using existing provenance where possible. Manual grants are preserved and cannot bypass archived profile access because the active staff profile gate denies staff/admin access while archived.
- This spec must run after, or be implemented against, @doc/specs/2026-07-01/identity-profile-split-hardening so shared lifecycle semantics, `/auth/me.profiles[]`, and active staff profile gating are already defined.
- This spec does not implement global identity-field correction. Email, phone, and fullName changes remain reserved for a future verified/admin identity-change flow; normal staff update and staff create-or-attach must not mutate those fields for linked identities.

## Task Links

- @task-6zhd41 [staff-multi-campus-existing-account-01] Add staff identity resolution foundation
- @task-zmyzmu [staff-multi-campus-existing-account-02] Add staff create-or-attach API
- @task-qa27oj [staff-multi-campus-existing-account-03] Integrate staff lifecycle and campus access
- @task-pu50tr [staff-multi-campus-existing-account-04] Enforce identity field and legacy endpoint boundaries
- @task-wqyjq8 [staff-multi-campus-existing-account-05] Verify auth profile projection for multi-campus staff

## Open Questions

None.
