---
title: Parent Multi-Campus Existing Account Frontend Handoff
description: Frontend-to-backend handoff for supporting one parent account across multiple campuses and attaching existing parent identities from staff workflows.
createdAt: '2026-06-30T23:05:05.177Z'
updatedAt: '2026-06-30T23:05:05.177Z'
tags:
  - frontend-handoff
  - parent-access
  - multi-campus
  - guardian
  - api
  - identity
---

## Purpose

This handoff summarizes frontend expectations for supporting a single parent account across multiple campuses. It is based on frontend and backend research performed on 2026-06-30.

The goal is to help backend quickly decide the correct backend behavior and produce a backend implementation spec. This document intentionally avoids backend implementation code and treats backend internals as areas for backend to confirm.

Relevant files observed during frontend/backend research:

- Frontend create guardian dialog: D:\Code\Kindercare\frontend\src\features\guardians\components\guardian-dialog.tsx
- Frontend create guardian hook: D:\Code\Kindercare\frontend\src\features\guardians\hooks\use-create-guardian.ts
- Frontend guardian service: D:\Code\Kindercare\frontend\src\features\guardians\services\guardian.service.ts
- Frontend guardian table: D:\Code\Kindercare\frontend\src\features\guardians\components\guardians-table.tsx
- Frontend guardian profile hero: D:\Code\Kindercare\frontend\src\features\guardians\components\profile\guardian-profile-hero.tsx
- Frontend parent campus discovery service: D:\Code\Kindercare\frontend\src\features\campuses\services\campus.service.ts
- Frontend parent campus discovery hook: D:\Code\Kindercare\frontend\src\features\campuses\hooks\use-guardian-campus-list.ts
- Backend guardian controller: D:\Code\Kindercare\backend\src\infra\http\controllers\user-management\guardian.controller.ts
- Backend create guardian use case: D:\Code\Kindercare\backend\src\application\user-management\use-cases\guardian\create-guardian.use-case.ts
- Backend identity service: D:\Code\Kindercare\backend\src\infra\external-services\clerk\identity.service.ts
- Backend guardian campus discovery use case: D:\Code\Kindercare\backend\src\application\user-management\use-cases\guardian\get-current-guardian-campuses.use-case.ts
- Backend guardian repository implementation: D:\Code\Kindercare\backend\src\infra\persistence\prisma\repositories\prisma-guardian.repository.ts
- Backend schema: D:\Code\Kindercare\backend\prisma\schema.prisma

## 1. Feature Summary

### What Feature We Are Building

We want staff to support a parent/guardian who belongs to children in more than one campus while using a single parent login.

From the parent side, the same authenticated parent should be able to discover all campuses where they have an active guardian profile, switch between those campuses in the parent workspace, and use parent self-service features scoped to the selected campus.

From the staff side, staff need a safe way to add a parent to the current campus when that parent may already have an account from another campus.

### Why We Are Building It

Today the parent runtime access model already expects guardian campus discovery to be driven by the authenticated user identity. However, the normal staff guardian creation workflow appears to create a new identity for each newly created guardian. That creates a gap:

- If staff in Campus A creates a parent, the parent gets one account.
- If staff in Campus B tries to create the same parent with the same email or phone, identity uniqueness may block creation.
- If staff uses a different email or phone, the parent may end up with separate accounts instead of one account that sees both campuses.

The desired product behavior is one real parent, one login, multiple campus-scoped guardian profiles when applicable.

### Main User Flow From The Frontend Perspective

Preferred low-friction flow:

1. Campus staff selects Campus B in the staff dashboard.
2. Staff opens the Guardians page.
3. Staff creates a guardian using the parent email/phone.
4. Backend determines whether this is a new parent account or an existing parent account that can be attached to Campus B.
5. Frontend receives a normal success response plus enough metadata to show clear success copy.
6. Staff links the guardian profile to one or more children in Campus B.
7. Parent logs in once and sees both Campus A and Campus B in the parent campus switcher.

Alternative explicit flow if backend/product requires confirmation:

1. Staff enters email/phone.
2. Frontend asks backend to check whether an eligible existing parent account exists.
3. Frontend shows a confirmation state such as "Existing parent account found" without exposing cross-campus private details.
4. Staff confirms attaching the existing account to the current campus.
5. Backend creates or restores the campus-scoped guardian profile linked to the existing identity.
6. Staff links children as usual.

## 2. Frontend Spec Summary

### Screens And Components Involved

Current staff-facing surfaces:

- Guardians page: D:\Code\Kindercare\frontend\src\app\dashboard\(people)\guardians\page.tsx
- Guardian create/edit dialog: D:\Code\Kindercare\frontend\src\features\guardians\components\guardian-dialog.tsx
- Guardian table: D:\Code\Kindercare\frontend\src\features\guardians\components\guardians-table.tsx
- Guardian profile page: D:\Code\Kindercare\frontend\src\app\dashboard\(people)\guardians\[guardianId]\page.tsx
- Guardian profile children tab: D:\Code\Kindercare\frontend\src\features\guardians\components\profile\children-tab.tsx
- Student profile guardians tab: D:\Code\Kindercare\frontend\src\features\students\components\profile\guardians-tab.tsx
- Relationship linking wizard: D:\Code\Kindercare\frontend\src\components\app-wide\link-relationship-wizard\link-relationship-wizard.tsx

Current parent-facing surfaces affected indirectly:

- Parent campus provider: D:\Code\Kindercare\frontend\src\components\parent-campus-provider.tsx
- Parent campus switcher: D:\Code\Kindercare\frontend\src\components\parent\parent-campus-switcher.tsx
- Parent campus discovery service: D:\Code\Kindercare\frontend\src\features\campuses\services\campus.service.ts
- Parent campus discovery hook: D:\Code\Kindercare\frontend\src\features\campuses\hooks\use-guardian-campus-list.ts

### Important UI States

For the current create dialog, frontend already supports:

- Empty form
- Client-side required field errors
- Submit loading state through mutation state
- Success toast and dialog close
- Backend failure toast and inline submit error

For multi-campus account support, frontend may need these additional states depending on backend contract:

- New parent account created for this campus
- Existing parent account attached to this campus
- Existing guardian already exists in this campus
- Existing parent account found but cannot be attached due to backend policy
- Existing parent account is archived or locked and requires backend-defined recovery behavior
- Email/phone conflict where backend cannot safely identify a single parent account
- Parent identity exists but does not match entered phone/email pair
- Permission denied for staff attempting attach/create in a campus they cannot manage

### User Actions We Need To Support

Frontend needs to support these staff actions:

- Create a new guardian in the selected staff campus.
- Attach or reuse an existing parent identity for a guardian in the selected staff campus, if backend supports this as part of create or as an explicit action.
- Link the created/attached guardian profile to students in the selected campus.
- View the guardian in the selected campus guardian table/profile.
- Lock/unlock/delete behavior should remain consistent with backend decisions for shared identities.

Frontend needs to support these parent actions after backend setup is complete:

- Parent logs in once.
- Parent sees all active campuses where their authenticated user has active guardian profiles.
- Parent switches between campuses in parent workspace.
- Parent sees only children linked to their guardian profile in the selected campus.
- Parent submits absence requests only for linked children in the selected campus.

### Validation Or Business Rules Assumed On The Frontend

Current create form assumes:

- Full name is required.
- Date of birth is required in the current UI.
- Gender is required.
- Phone number is required.
- Email is required.
- Campus is selected through staff campus context, not manually selected inside the dialog.

Frontend should not be responsible for determining whether an existing parent account can be reused. That must be backend-owned because it involves identity, permissions, cross-campus privacy, and conflict handling.

Frontend assumes backend remains authoritative for:

- Email and phone uniqueness/conflict behavior.
- Whether a same-email or same-phone identity is the same parent.
- Whether an archived/locked identity can be reused.
- Whether the staff user can create or attach guardians in the selected campus.
- Same-campus enforcement for guardian/student/relationship links.

## 3. Backend Needs / Assumptions

### What Data The Frontend Needs

For the create/attach result, frontend needs enough information to update the current campus guardian list and show accurate user feedback:

- Guardian id for the current campus.
- Campus id for the guardian profile.
- Guardian display fields currently shown in UI: full name, email, phone number, date of birth, gender, archived/active status, created/updated timestamps.
- Whether the backend created a new identity or reused/attached an existing identity.
- Whether the guardian profile was newly created, restored, or already existed in the selected campus.
- A user-safe status message or machine-readable result status for frontend copy.

For optional explicit lookup/confirmation, frontend may need a privacy-safe preview:

- Whether a reusable parent account exists.
- Display-safe parent name, email, and phone if allowed.
- Whether the account is eligible to attach to the current campus.
- Reason code when not eligible.
- No private cross-campus student data.
- No list of other campuses unless backend/product explicitly approves exposing that to this staff user.

### What Actions The Frontend Needs To Perform

Minimum action:

- Submit guardian create details for the currently selected campus and let backend create or reuse as appropriate.

Possible explicit attach actions:

- Lookup existing parent account by email/phone within backend-defined privacy constraints.
- Confirm attaching an eligible existing parent account to the current campus.
- Cancel attach and return to editing form.

Existing linked-child actions should continue to work:

- Link guardian to student in current campus.
- Change relationship type.
- Unlink guardian from student.

### Existing APIs We Think May Be Reusable

Potentially reusable, subject to backend confirmation:

- Existing guardian create endpoint, if backend wants create to become create-or-attach behavior.
- Existing guardian list/get endpoints for current campus display.
- Existing guardian-student link endpoints for linking children after guardian profile exists.
- Existing parent campus discovery endpoint for parent workspace campus list.
- Existing parent self-service student endpoint for selected-campus children.

### New Or Changed APIs We May Need

This depends on backend/product decision.

Option A: Change existing create guardian behavior.

- The existing create guardian endpoint can create a new parent account or reuse an existing parent identity when the email/phone already belongs to an eligible parent.
- Frontend impact is smallest.
- Backend must return a result status so frontend can show correct success copy.

Option B: Add explicit lookup and attach endpoints.

- Frontend can show a clearer confirmation step.
- Backend can keep create semantics stricter.
- More frontend work, but less surprising behavior for staff.

Option C: Add a dedicated create-or-attach endpoint.

- Avoids changing current create semantics too broadly.
- Frontend can use the new endpoint only from the updated guardian create flow.
- Backend can deprecate or keep old create semantics separately.

### Backend Behavior We Are Assuming But Have Not Confirmed

Backend should confirm these before implementation:

- Whether identity uniqueness is global across all campuses through the identity provider.
- Whether email and phone must both match an existing identity before attaching, or whether one matching identifier is sufficient.
- Whether a guardian profile can be created in Campus B using an existing User from Campus A without creating a new identity.
- Whether staff should ever see that a parent belongs to another campus.
- Whether archived guardian profiles should be restored or block attach.
- Whether locked identity behavior should apply globally or per campus profile.
- Whether hard delete of one campus guardian should affect a shared identity that is still used in another campus.
- Whether there are existing duplicate/separate parent accounts that require migration before or during rollout.

## 4. Suggested API Contract

This section describes frontend needs. Backend should adjust names, routing, and final response details to match backend conventions.

### Proposed Endpoints

Preferred minimal-change endpoint:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /guardians | Create a guardian in the selected campus, reusing an existing parent identity when backend determines it is safe. |

Optional explicit-flow endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /guardians/resolve-parent-account | Check whether the submitted email/phone maps to an existing reusable parent identity. |
| POST | /guardians/attach-existing-parent | Attach an eligible existing parent identity to a new guardian profile in the selected campus. |

Alternative dedicated endpoint:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | /guardians/create-or-attach | Create a new parent account or attach an existing parent account in the selected campus. |

All staff-facing routes should remain scoped to the selected campus through the existing campus header pattern.

### Request Payloads

For create-or-attach behavior, frontend can provide the same data it currently collects:

| Field | Required | Notes |
| --- | --- | --- |
| fullName | Required | Current UI requires this. Backend remains authoritative on length/format. |
| email | Required | Current UI requires this. Used for identity resolution if backend supports reuse. |
| phoneNumber | Required | Current UI requires this. Used for identity resolution if backend supports reuse. |
| gender | Required | Current UI requires this. |
| dateOfBirth | Required by current frontend | Backend should confirm whether this is truly required for guardian create. |
| address | Optional | Current create dialog may not collect this today. |
| occupation | Optional | Current create dialog may not collect this today. |
| workAddress | Optional | Current create dialog may not collect this today. |

For explicit attach confirmation, frontend may send:

| Field | Required | Notes |
| --- | --- | --- |
| parentAccountResolutionId or parentUserId | Required if explicit attach is used | Prefer opaque resolution id if backend wants to avoid exposing user ids. |
| fullName | Required or optional by backend policy | Used for campus guardian profile. |
| email | Required | Should match resolution or backend should reject. |
| phoneNumber | Required | Should match resolution or backend should reject. |
| gender | Required | Campus guardian profile field. |
| dateOfBirth | Required by current frontend | Backend should confirm policy. |
| address | Optional | Campus guardian profile field. |
| occupation | Optional | Campus guardian profile field. |
| workAddress | Optional | Campus guardian profile field. |

### Response Shapes

For create-or-attach success, frontend needs:

| Field | Required | Notes |
| --- | --- | --- |
| guardian | Required | The guardian profile for the selected campus. Existing GuardianDTO-compatible shape is ideal. |
| resultStatus | Required | Machine-readable status such as created_new_account, attached_existing_account, restored_existing_guardian, already_exists_in_campus. Backend can choose exact enum names. |
| message | Optional | Human-readable fallback. Frontend may still localize copy client-side. |
| accountSharedAcrossCampuses | Optional | Boolean if backend/product allows this signal. |
| requiresAction | Optional | For states such as invite pending, password reset, locked account, or manual review. |

For explicit lookup success, frontend needs:

| Field | Required | Notes |
| --- | --- | --- |
| matchStatus | Required | no_match, eligible_match, ineligible_match, ambiguous_match, already_in_campus, or backend equivalent. |
| resolutionId | Required for eligible match | Opaque id preferred for attach confirmation. |
| displayName | Optional | Only if safe to show. |
| email | Optional | Only if safe to show. |
| phoneNumber | Optional | Only if safe to show. |
| reasonCode | Optional | Used for ineligible or ambiguous states. |
| message | Optional | Human-readable fallback. |

### Error States The Frontend Needs To Handle

Frontend can handle these as machine-readable error codes or stable message/status values:

- Missing or invalid campus context.
- Staff lacks permission for current campus.
- Guardian with same email already exists in this campus.
- Guardian with same phone already exists in this campus.
- Existing identity found but not eligible to attach.
- Existing identity lookup is ambiguous.
- Email belongs to one identity and phone belongs to a different identity.
- Identity provider conflict.
- Parent account is locked or archived and backend requires restoration first.
- Guardian/student/relationship link rejected due to cross-campus mismatch.
- Validation errors for required fields and formats.

### Loading, Empty, Success, Failure Cases

Loading:

- Create/attach submit button should show pending state.
- Optional lookup step should show resolving state.
- Parent campus switcher already handles campus discovery loading.

Empty:

- No match found should let staff continue creating a new account, if permitted.
- No guardian campuses for parent remains an existing empty/no-access state.

Success:

- New account created: show standard "Guardian created" copy.
- Existing account attached: show copy such as "Existing parent account linked to this campus" if backend returns a status.
- Already exists in campus: backend should decide whether this is a success/no-op or conflict; frontend can handle either if status is stable.

Failure:

- Show backend validation or conflict message in the dialog.
- Keep entered form values so staff can correct input.
- Do not expose cross-campus private details in error copy unless backend explicitly returns a safe message.

## 5. Data Requirements

### Fields Needed By The UI

Guardian table/profile currently use:

| Field | Required For UI | Notes |
| --- | --- | --- |
| id | Required | Routing and actions. |
| fullName | Required | Table/profile display. |
| email | Required by current create UI; optional display fallback exists | Table shows dash if absent, but create currently requires it. |
| phoneNumber | Required | Table/profile display and create. |
| dateOfBirth | Required by current create UI; optional display fallback exists | Used for age/date display. |
| gender | Required | Badge/avatar styling. |
| userId | Optional for UI today | Present in DTO type but not displayed. Could remain hidden. |
| isArchived | Required | Status badges and lock/unlock behavior. |
| createdAt | Required | Profile metadata. |
| updatedAt | Optional for display, useful for cache freshness. |
| children | Optional | Profile/list can fetch children separately. |

Potential new metadata:

| Field | Required For UI | Notes |
| --- | --- | --- |
| resultStatus | Required if backend supports create-or-attach | Needed for accurate toast/copy. |
| accountLinkedStatus | Optional | Could distinguish has account, attached existing account, pending invite, locked. |
| canAttach | Required for explicit lookup flow | Determines CTA state. |
| reasonCode | Required for explicit lookup failures | Enables stable frontend handling. |

### Which Fields Are Required Vs Optional

Current frontend required fields:

- fullName
- email
- phoneNumber
- dateOfBirth
- gender

Frontend can adapt if backend decides dateOfBirth should be optional, but the current form treats it as required.

Optional fields not currently central in the create UI:

- address
- occupation
- workAddress

### Filtering, Sorting, Pagination, Permissions, Status Logic

Current guardian list behavior should remain campus-scoped and paginated through existing list patterns.

Current table filters include:

- fullName
- email
- phoneNumber
- dateOfBirth
- gender
- isArchived

Current sortable columns include:

- fullName
- email
- phoneNumber
- dateOfBirth
- createdAt
- updatedAt

Permission expectations:

- Staff can only create or attach guardian profiles for campuses they are authorized to manage.
- Parent campus discovery remains separate from staff RBAC campus access.
- Staff should not gain access to another campus's students or private guardian relationships through lookup/attach.

Status expectations:

- Active guardian profiles should be discoverable by parent account.
- Archived guardian profiles should not appear in parent campus discovery unless backend/product decides otherwise.
- Locked identity behavior needs backend clarification because one identity may be shared by multiple campus guardian profiles.

## 6. Questions For Backend

1. Should existing POST /guardians become create-or-attach, or should frontend use a new explicit endpoint?
2. Is silent reuse acceptable, or must staff explicitly confirm attaching an existing parent account?
3. What is the safe matching rule: email only, phone only, both email and phone, or another identity verification process?
4. What should happen when email matches one identity but phone matches another?
5. What should happen when a matching identity exists but has no guardian profile yet?
6. What should happen when a matching identity already has a guardian profile in the selected campus?
7. What should happen when the matching guardian profile in the selected campus is archived?
8. What should happen when the shared identity is locked because of an archived guardian in another campus?
9. Should campus staff see any signal that the parent account is also used elsewhere?
10. If staff can see a signal, what exact data is privacy-safe to expose?
11. Does hard delete of a guardian profile currently delete the shared identity, and would that be unsafe once identities are shared across campuses?
12. Are there existing production records with duplicate parent identities that need migration or admin tooling?
13. Should backend add same-campus enforcement to guardian-student relationship linking when linking from either guardian profile or student profile flows?
14. Should relationship type also be validated against the selected campus during linking?
15. Should audit distinguish newly created parent identity versus existing identity attached to campus?
16. Does backend need an invitation/password reset behavior when attaching an existing parent account to a new campus?
17. Should backend return a stable result status on create/attach for frontend localization?
18. Are there tenant/privacy constraints around searching for existing identity by email/phone across campuses?

## 7. Risks / Dependencies

### Areas Where Frontend Work Depends On Backend Decisions

Frontend implementation depends on whether backend chooses:

- Silent create-or-attach behavior on current create endpoint.
- Explicit lookup and confirmation flow.
- New dedicated create-or-attach endpoint.
- Whether staff can be told an account exists elsewhere.
- Which conflict states are recoverable by staff versus require admin support.
- Whether result status metadata will be returned on success.

If backend supports silent reuse with a stable success status, frontend work is small: update success copy and error handling.

If backend requires explicit attach confirmation, frontend work is larger: add lookup state, confirmation UI, privacy-safe preview, additional mutation, and new failure states.

### Possible Technical Debt Or Migration Concerns

Areas backend should investigate:

- Existing guardian create behavior appears identity-provider-first, then internal user and guardian creation. This may not support attaching an existing identity without backend changes.
- The schema appears to allow one user to have guardian profiles in multiple campuses, but create behavior may not currently use that capability.
- Lock/unlock/delete flows may assume one guardian profile maps to one identity. Shared identity semantics may require changes.
- Existing duplicate parent accounts may already exist if staff worked around conflicts using different emails/phones.
- Guardian-student link flows may need stronger backend campus consistency checks.

### Anything That Could Change Frontend Implementation

Frontend implementation may change significantly if backend decides:

- Staff must not know whether a parent account exists outside their campus.
- Parent account attach requires a separate verification step.
- Email/phone lookup cannot be exposed to staff.
- Existing parent attach requires admin-only permission.
- Date of birth or phone number rules change during account reuse.
- Shared identity lock/delete behavior introduces new staff-facing status states.

## 8. Acceptance Criteria From Frontend Perspective

Backend work unblocks frontend when these are true:

1. Staff can create or attach a guardian profile in the selected campus for a parent who already has an account in another campus, without creating a second parent login.
2. The same parent login discovers both campuses through the existing parent campus discovery endpoint after both guardian profiles are active.
3. Parent campus discovery returns only campuses where the current authenticated user has active guardian access.
4. Parent self-service student list remains scoped to the selected campus and only shows linked children.
5. Staff cannot attach or create a guardian profile in a campus they are not authorized to manage.
6. Guardian-student linking rejects cross-campus guardian/student/relationship combinations at the backend.
7. Frontend receives stable success status for new account created versus existing account attached, or backend confirms that frontend should use generic success copy only.
8. Frontend receives stable error statuses/messages for duplicate-in-current-campus, ambiguous identity, permission denied, locked/archived identity, and validation failures.
9. Existing guardian list/profile responses continue to support the current table/profile fields.
10. Lock/unlock/delete behavior is explicitly defined for shared identities so frontend does not accidentally offer destructive actions with unclear scope.

Frontend verification plan after backend delivery:

1. Create parent in Campus A through staff UI.
2. Link parent to a Campus A child.
3. Create or attach the same parent in Campus B using the backend-supported flow.
4. Link parent to a Campus B child.
5. Log in as the parent once.
6. Confirm parent workspace lists both Campus A and Campus B.
7. Switch to Campus A and confirm only Campus A linked children/actions are available.
8. Switch to Campus B and confirm only Campus B linked children/actions are available.
9. Attempt duplicate create in the same campus and confirm frontend receives the expected backend status/error.
10. Attempt or simulate cross-campus linking and confirm backend rejects it.
