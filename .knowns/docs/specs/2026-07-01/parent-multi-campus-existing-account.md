---
title: Parent Multi-Campus Existing Account
description: Specification for creating or attaching campus-scoped guardian profiles to one shared parent identity across multiple campuses.
createdAt: '2026-07-01T01:21:35.226Z'
updatedAt: '2026-07-10T22:05:01.271Z'
tags:
  - spec
  - approved
  - parent-access
  - multi-campus
  - guardian
  - identity
  - api
---

# Parent Multi-Campus Existing Account

## Overview

Support one parent login across multiple campuses by letting authorized staff create a campus-scoped `Guardian` profile that either provisions a new parent identity or attaches to an existing eligible parent `User`. Parent runtime access remains relationship-based: once the selected-campus guardian profile is active and linked to children, the parent discovers that campus through `GET /guardians/me/campuses` and accesses parent self-service features only through active guardian-student relationships.

This spec is scoped to backend behavior for create-or-attach, shared-identity safety, and guardian-student campus isolation. It builds on @doc/archive/research/parent-multi-campus-existing-account-backend-research and the existing parent access model in @doc/specs/2026-06-28/parent-access-model-and-campus-discovery.

## Locked Decisions

- D1: V1 uses a dedicated `POST /guardians/create-or-attach` endpoint with a single-submit frontend UX and no explicit lookup/confirmation step.
- D2: Attach is allowed only when normalized email and phone both resolve to exactly the same existing internal `User`; one-sided matches and split matches are rejected with stable mismatch/ambiguous statuses.
- D3: If the matched `User` already has an active guardian profile in the selected campus, return it with `ALREADY_EXISTS_IN_CAMPUS`; if the selected-campus profile is archived, restore it and return `RESTORED_EXISTING_GUARDIAN`.
- D4: Staff-facing create-or-attach responses expose only selected-campus guardian data and selected-campus result status. They must not expose other-campus names, child data, or relationship details.
- D5: Normal staff archive, restore, and hard-delete are campus guardian profile-scoped. Identity lock/delete are super-admin-only operations and must not be triggered by normal campus guardian archive/delete for any linked `User`, shared or single-profile.
- D6: Linked guardian profile edits are campus-local for normal staff only for non-identity profile fields. Email, phone, and `fullName` are global identity fields; normal staff identity-field changes are blocked for linked identities and reserved for a future verified/admin identity-change flow.
- D7: If the identity provider has an existing email or phone but backend cannot match it to an internal `User`, v1 rejects with `IDENTITY_PROVIDER_CONFLICT` and requires manual review.
- D8: Audit taxonomy uses existing `CREATE_GUARDIAN` for new account creation, existing `RESTORE_GUARDIAN` for archived profile restoration, and a new `ATTACH_EXISTING_GUARDIAN_IDENTITY` action when a new campus guardian profile is linked to an existing `User`. `ALREADY_EXISTS_IN_CAMPUS` is a no-op and does not emit a mutation audit event unless a future audit policy explicitly requires no-op records.
- D9: `fullName` is a global identity display field in v1. For linked identities, normal staff attempts to update `fullName` must be blocked with a stable identity-field restriction and must not update the selected-campus `Guardian` row or Clerk public metadata.
- D10: Success outcomes return 2xx responses with `resultStatus`; unsafe identity states use normal error responses. `IDENTITY_IDENTIFIER_MISMATCH`, `AMBIGUOUS_IDENTITY_MATCH`, and `IDENTITY_PROVIDER_CONFLICT` use `409 Conflict`; validation and auth failures keep existing 400/401/403 behavior.

## Requirements

### Functional Requirements

- FR-1: Add a staff-facing `POST /guardians/create-or-attach` endpoint scoped by the existing campus header and normal `@RequireCampusAccess()` staff/RBAC path.
- FR-2: The create-or-attach request must accept the same guardian profile fields as current guardian create: `fullName`, `email`, `phoneNumber`, `gender`, optional `dateOfBirth`, `address`, `occupation`, and `workAddress`.
- FR-3: Backend remains authoritative for validation. `dateOfBirth` remains optional, but when provided must satisfy the existing adult guardian validation.
- FR-4: If neither normalized email nor normalized phone resolves to an existing parent identity, the endpoint must provision a new identity, create a new internal `User`, create the selected-campus `Guardian`, emit `CREATE_GUARDIAN`, and return `CREATED_NEW_ACCOUNT` in a 2xx response.
- FR-5: If normalized email and phone both resolve to exactly the same existing internal `User`, and that user has no guardian profile in the selected campus, the endpoint must create a new selected-campus `Guardian` linked to the existing `User`, emit `ATTACH_EXISTING_GUARDIAN_IDENTITY`, and return `ATTACHED_EXISTING_ACCOUNT` in a 2xx response.
- FR-6: If normalized email and phone resolve to different users, or only one identifier resolves to a user, the endpoint must reject auto-attach with `409 Conflict` and a stable error code such as `IDENTITY_IDENTIFIER_MISMATCH` or `AMBIGUOUS_IDENTITY_MATCH`.
- FR-7: If the selected-campus active guardian profile already exists for the matched `User`, the endpoint must not create a duplicate; it must return the existing selected-campus guardian with `ALREADY_EXISTS_IN_CAMPUS` in a 2xx response and must not emit a mutation audit event.
- FR-8: If the selected-campus guardian profile exists but is archived for the matched `User`, the endpoint must restore that profile, emit `RESTORE_GUARDIAN`, and return `RESTORED_EXISTING_GUARDIAN` in a 2xx response.
- FR-9: If Clerk or another identity provider reports an existing identifier but backend cannot map it to an internal `User`, the endpoint must reject with `409 Conflict` and `IDENTITY_PROVIDER_CONFLICT`, and must not create a duplicate account.
- FR-10: Create-or-attach success responses must include the selected-campus `Guardian` response data and a stable `resultStatus` enum. They must not include other-campus names, other-campus guardian records, children, or relationships.
- FR-11: Create-or-attach audit data must distinguish new identity creation, existing identity attach, and archived profile restoration without logging cross-campus private details.
- FR-12: Existing parent campus discovery must work after attach: the parent sees every non-archived campus where the authenticated `User` has a non-archived guardian profile.
- FR-13: Existing parent self-service student access must remain scoped by selected campus and active guardian-student relationships; no parent endpoint may trust a client-provided `userId` or `guardianId` for self-service identity.
- FR-14: Normal staff archive, restore, and hard-delete operations for guardians must operate on the selected-campus `Guardian` profile. They must not lock, unlock, activate, deactivate, or delete any linked `User` or Clerk identity.
- FR-15: Super-admin-only global identity lock/delete behavior, if present, must remain separate from normal campus guardian archive/restore/delete and must not be implicitly invoked by create-or-attach.
- FR-16: For any `Guardian` linked to a `User`, normal staff updates must block email, phone, and `fullName` identity-field changes with `409 Conflict` and a stable error code such as `SHARED_IDENTITY_UPDATE_RESTRICTED` or equivalent.
- FR-17: Non-identity guardian profile fields such as `address`, `occupation`, `workAddress`, `gender`, and `dateOfBirth` remain campus-local for normal staff edits. Updates to those fields must not sync Clerk identity fields. Any future global identity-field update flow is out of scope for this spec.
- FR-18: Guardian-student link, unlink, and relationship-update flows must enforce same-campus consistency for selected campus, guardian, student, and guardian relationship type.
- FR-19: Cross-campus guardian/student/relationship-type combinations must be rejected before mutation and must not create, update, or delete `GuardianStudent` rows.
- FR-20: Existing `POST /guardians` behavior may remain strict and backward-compatible. If implementation later delegates it to create-or-attach, that change must preserve or explicitly update documented response semantics.

### Non-Functional Requirements

- NFR-1: Privacy: staff create-or-attach responses and errors must not disclose another campus's students, guardian relationships, or campus list.
- NFR-2: Security: staff attach/create remains RBAC campus-access governed; parent discovery and self-service remain relationship governed and must not grant staff/admin permissions.
- NFR-3: Consistency: DB writes and audit records for create, attach, restore, and relationship mutations must remain transactionally consistent using existing Unit of Work patterns where applicable.
- NFR-4: Identity safety: backend must not create duplicate Clerk identities for identifiers that the identity provider says are already in use.
- NFR-5: Backward compatibility: existing guardian list/profile DTO fields must remain available to current frontend table and profile surfaces.
- NFR-6: Testability: every result status and linked-identity side effect must be covered by focused unit or repository tests.

## Acceptance Criteria

- [ ] AC-1: `POST /guardians/create-or-attach` creates a new Clerk/internal `User` and selected-campus `Guardian` when neither email nor phone matches an existing parent identity, emits `CREATE_GUARDIAN`, and returns `CREATED_NEW_ACCOUNT` in a 2xx response.
- [ ] AC-2: `POST /guardians/create-or-attach` attaches a new selected-campus `Guardian` to an existing `User` when email and phone both resolve to the same existing internal `User`, emits `ATTACH_EXISTING_GUARDIAN_IDENTITY`, returns `ATTACHED_EXISTING_ACCOUNT` in a 2xx response, and does not provision Clerk.
- [ ] AC-3: One-sided identifier matches and split email/phone matches return `409 Conflict` with stable mismatch/ambiguous error codes and no new guardian or identity is created.
- [ ] AC-4: Identity-provider conflicts without an internal `User` mapping return `409 Conflict` with `IDENTITY_PROVIDER_CONFLICT` and do not create duplicate accounts.
- [ ] AC-5: Same-campus active existing guardian profiles are returned without duplication and with `ALREADY_EXISTS_IN_CAMPUS`, and no mutation audit event is emitted.
- [ ] AC-6: Same-campus archived guardian profiles for the matched `User` are restored, `RESTORE_GUARDIAN` is emitted, and `RESTORED_EXISTING_GUARDIAN` is returned.
- [ ] AC-7: Success responses expose selected-campus guardian data and `resultStatus`, but no other-campus campus names, child records, or relationship details.
- [ ] AC-8: Staff without access to the selected campus cannot create or attach a guardian profile there.
- [ ] AC-9: After attach, `GET /guardians/me/campuses` returns the newly attached campus for the parent user only when the guardian profile and campus are active.
- [ ] AC-10: Parent self-service student access after attach returns only active children linked to the selected-campus guardian profile.
- [ ] AC-11: Normal staff archive hides that campus from parent campus discovery but does not lock, deactivate, or delete the linked global identity.
- [ ] AC-12: Normal staff restore reactivates the selected-campus guardian profile without calling global identity unlock or incorrectly unlocking a globally locked identity.
- [ ] AC-13: Normal staff hard-delete or dangerous delete behavior is profile-only and preserves the linked `User`/Clerk identity; global identity delete remains a separate super-admin operation.
- [ ] AC-14: Updating email, phone, or `fullName` on a guardian profile linked to a `User` is blocked with `409 Conflict` and `SHARED_IDENTITY_UPDATE_RESTRICTED` or equivalent stable error.
- [ ] AC-15: Updating non-identity profile fields on a linked guardian profile updates only the selected-campus guardian profile and does not sync Clerk identity fields.
- [ ] AC-16: Guardian-student link, unlink, and relationship update reject cross-campus guardian/student/relationship-type combinations before mutation.
- [ ] AC-17: Create-or-attach emits audit records for new account creation, existing identity attach, and archived profile restoration without exposing cross-campus private details.
- [ ] AC-18: Existing guardian list/get/profile responses continue to support current frontend fields: id, campusId, userId, fullName, email, phoneNumber, dateOfBirth, gender, isArchived, children where already included, createdAt, and updatedAt.

## Scenarios

### Scenario 1: Staff Creates A New Parent Account

**Given** staff has normal campus access to Campus B
**And** no existing internal or identity-provider user owns the submitted email or phone
**When** staff submits `POST /guardians/create-or-attach`
**Then** backend provisions a new identity, creates a new internal `User`, creates a Campus B `Guardian`, records `CREATE_GUARDIAN`, and returns `CREATED_NEW_ACCOUNT`.

### Scenario 2: Staff Attaches Existing Parent To Another Campus

**Given** a parent has an active guardian profile in Campus A linked to internal `User U`
**And** staff has normal campus access to Campus B
**When** staff submits Campus B guardian data whose email and phone both resolve to `User U`
**Then** backend creates a Campus B `Guardian` linked to `User U`
**And** records `ATTACH_EXISTING_GUARDIAN_IDENTITY`
**And** returns `ATTACHED_EXISTING_ACCOUNT`
**And** does not disclose Campus A details to staff.

### Scenario 3: Parent Discovers Both Campuses After Attach

**Given** `User U` has active guardian profiles in Campus A and Campus B
**When** the parent calls `GET /guardians/me/campuses`
**Then** both active campuses are returned
**And** staff/admin RBAC campus assignments are not used to decide the parent campus list.

### Scenario 4: Same-Campus Active Profile Already Exists

**Given** the submitted email and phone resolve to `User U`
**And** `User U` already has an active guardian profile in the selected campus
**When** staff submits create-or-attach for that campus
**Then** backend returns the existing selected-campus guardian with `ALREADY_EXISTS_IN_CAMPUS`
**And** no duplicate guardian is created
**And** no mutation audit event is emitted.

### Scenario 5: Same-Campus Archived Profile Is Restored

**Given** the submitted email and phone resolve to `User U`
**And** `User U` has an archived guardian profile in the selected campus
**When** staff submits create-or-attach for that campus
**Then** backend restores the selected-campus guardian profile
**And** records `RESTORE_GUARDIAN`
**And** returns `RESTORED_EXISTING_GUARDIAN`.

### Scenario 6: Identifier Mismatch Is Rejected

**Given** the submitted email resolves to `User A`
**And** the submitted phone resolves to no user or to `User B`
**When** staff submits create-or-attach
**Then** backend returns `409 Conflict` with a stable mismatch/ambiguous error code
**And** no new identity or guardian profile is created.

### Scenario 7: Identity Provider Conflict Requires Manual Review

**Given** Clerk reports the submitted email or phone already exists
**And** backend cannot map that identity to an internal `User`
**When** staff submits create-or-attach
**Then** backend returns `409 Conflict` with `IDENTITY_PROVIDER_CONFLICT`
**And** no duplicate Clerk identity is attempted.

### Scenario 8: Archive Is Profile-Scoped

**Given** `User U` has a guardian profile in Campus B
**When** Campus B staff archives the Campus B guardian profile
**Then** Campus B is removed from parent campus discovery
**And** the linked global identity is not locked, deactivated, or deleted
**And** any other active guardian or staff profile on the same identity remains governed by its own active profile access.

### Scenario 9: Linked Identity Edit Is Restricted

**Given** `User U` has a linked guardian profile
**When** normal staff attempts to update email, phone, or `fullName` on that guardian profile
**Then** backend returns `409 Conflict` with `SHARED_IDENTITY_UPDATE_RESTRICTED` or an equivalent stable identity-field restriction
**And** neither the selected-campus `Guardian` identity field nor Clerk identity fields are changed.

### Scenario 10: Non-Identity Linked Profile Edit Is Profile-Local

**Given** `User U` has a linked guardian profile
**When** normal staff updates a non-identity profile field such as `occupation` or `workAddress` on one selected-campus guardian profile
**Then** backend updates only that selected-campus guardian profile
**And** Clerk identity fields are not changed.

### Scenario 11: Cross-Campus Link Is Rejected

**Given** a guardian profile belongs to Campus A
**And** a student or relationship type belongs to Campus B
**When** staff attempts to link or update the guardian-student relationship under one selected campus
**Then** backend rejects the request before mutation
**And** no `GuardianStudent` row is created or changed.

## Technical Notes

- Relevant research: @doc/archive/research/parent-multi-campus-existing-account-backend-research.
- Parent access pattern: @doc/patterns/guards-pattern#parent-self-service-relationship-access.
- Existing parent campus discovery spec: @doc/specs/2026-06-28/parent-access-model-and-campus-discovery.
- Canonical shared identity/profile lifecycle semantics are defined by @doc/specs/2026-07-01/identity-profile-split-hardening; this spec should run after, or be implemented against, that lifecycle hardening.
- The schema already permits multiple campus `Guardian` rows per `User` through `@@unique([campusId, userId])`; implementation should use that model rather than adding RBAC roles for parents.
- The identity resolution implementation should avoid global `findFirst` semantics for email/phone because those cannot distinguish ambiguous matches. Repository or identity-port additions should return enough matches to classify safe, one-sided, split, ambiguous, and provider-conflict states.
- Create-or-attach may reuse existing create logic for the no-match branch, but the existing create path must not call Clerk provisioning for the attach branch.
- Normal guardian archive, restore, and hard-delete are profile-scoped and must not touch `User.isActive` or Clerk lock/unlock/delete. Global identity lock/unlock/delete is handled separately by @doc/specs/2026-07-01/identity-profile-split-hardening.
- Guardian identity fields (`email`, `phoneNumber`, and `fullName`) are global identity fields for linked profiles. Normal campus guardian/staff profile updates must not mutate those fields; correction is reserved for a future verified/admin identity-change flow outside this spec.
- Relationship mutation hardening should cover both guardian-side routes (`/guardians/:id/students`) and student-side routes that link/unlink/update guardians.

## Task Links

- @task-08k8au [parent-multi-campus-existing-account-01] Add create-or-attach API contract
- @task-sl5mr0 [parent-multi-campus-existing-account-02] Add guardian identity resolution and conflict classification
- @task-wpmu4w [parent-multi-campus-existing-account-03] Implement create attach restore and no-op outcomes
- @task-xt5oti [parent-multi-campus-existing-account-04] Preserve parent campus discovery and self-service scoping
- @task-az371m [parent-multi-campus-existing-account-05] Keep guardian lifecycle profile-scoped
- @task-0syskz [parent-multi-campus-existing-account-06] Restrict linked guardian identity-field edits
- @task-62nsg7 [parent-multi-campus-existing-account-07] Enforce same-campus guardian-student relationship mutations
- @task-82uoan [parent-multi-campus-existing-account-08] Add end-to-end regression and contract coverage

## Open Questions

None.
