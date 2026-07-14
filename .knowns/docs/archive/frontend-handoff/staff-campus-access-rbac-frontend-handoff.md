---
title: Staff Campus Access RBAC Frontend Handoff
description: Frontend-to-backend handoff for staff campus access RBAC remediation, including frontend requirements, backend assumptions, suggested API contracts, data needs, questions, risks, and acceptance criteria.
createdAt: '2026-07-07T08:52:18.179Z'
updatedAt: '2026-07-07T09:39:22.823Z'
tags:
  - frontend-handoff
  - staff
  - campus
  - rbac
  - api-needed
  - draft
---

# Staff Campus Access RBAC Frontend Handoff

Status: Draft for backend research and implementation planning.
Direction: Frontend -> Backend.
Storage owner: Backend documentation area.
Frontend source context: staff creation / campus access remediation plan derived from @doc/architecture/rbac-system, @doc/specs/2026-06-26/rbac-admin-management-api-hardening, and @doc/specs/2026-07-01/identity-profile-split-hardening.

This document is intentionally limited to frontend integration needs. It does not prescribe backend code structure, persistence design, internal services, queues, or implementation architecture.

## 1. Feature Summary

The frontend is planning a staff campus access remediation flow for the staff creation and RBAC setup experience. The product problem is that a staff profile can be created in a campus but the linked user can still see `No Campus` on mobile if they do not have a campus-scoped role assignment.

The frontend experience should make staff access status understandable and actionable for admin users. A successful staff creation that is intended to produce a login-capable staff user should either result in a campus-scoped role assignment or produce a clear, recoverable state that the admin can fix.

Main user flow from the frontend perspective:

1. Admin selects or enters a campus-scoped staff management area.
2. Frontend loads staff types and relevant campus roles for the selected campus.
3. Admin creates or attaches a staff identity/profile.
4. Frontend determines whether the created/attached staff user is login-ready for the selected campus.
5. If access is missing, frontend guides the admin to configure a staff type default role or assign a role directly to the staff user's backend `userId`.
6. Frontend refreshes staff, role, and campus discovery data where the affected user or current user can observe stale access.

Backend support is required for:

- Campus discovery and role-based campus access signals.
- Staff creation or create-or-attach behavior that returns enough data to continue the workflow.
- Staff type catalog data, especially `defaultRoleId`.
- Campus role catalog data, including role mutability/read-only flags.
- Role assignment to an existing backend user.
- Optional backend-owned login-ready/access status so frontend does not infer business-critical RBAC state from incomplete local data.
- Clear validation, permission, conflict, and refresh semantics.

User outcomes that depend on backend behavior:

- A newly created/attached staff member can discover and enter the intended campus after signing in.
- Admin can distinguish a profile that exists in a campus from a user that has campus login access.
- Admin can remediate missing campus access without guessing which role/user/profile IDs are valid.
- Frontend can show accurate empty/error states for `No Campus`, permission denied, duplicate identity, archived staff type, invalid default role, and missing role configuration.

## 2. Frontend Spec Summary

### Screens Or User-Facing Areas Involved

- Staff management create/edit dialog or equivalent staff profile creation surface.
- Staff detail or staff list row status area for access readiness.
- RBAC role management area under campus settings.
- Staff type management/configuration area if default role assignment is exposed there.
- Mobile or workspace campus discovery state that currently shows `No Campus` when no accessible campus is returned.
- Optional remediation dialog or panel for assigning a campus role to an existing staff user.

### Important UI States

- Campus discovery loading, success, empty, unauthorized, and permission/error states.
- Staff type loading, empty, loaded with default roles, and loaded with no default-role-capable choices.
- Staff creation submitting, success, validation error, conflict, permission denied, and retryable failure.
- Staff created/attached and login-ready.
- Staff created/attached but missing campus-scoped role.
- Role assignment submitting, success, no-op/already assigned, permission denied, and retryable failure.
- Staff type default-role update submitting, success, invalid role, permission denied, and conflict.

### User Actions

- Open staff management for a selected campus.
- Create or attach staff.
- Select staff type(s).
- Inspect staff type default role readiness.
- Create or choose a campus role.
- Assign a campus role to a staff user's backend `userId`.
- Configure a staff type `defaultRoleId` for future staff creation.
- Refresh staff list/detail and campus discovery.
- Retry failed network or server operations.

### Data Displayed To The User

- Campus name and campus access status.
- Staff profile identity fields and profile fields.
- Staff type names and whether they are configured with a default role.
- Role names, read-only/mutability state, and permission summary where available.
- Staff access/readiness status, if backend can provide it.
- Backend validation and conflict messages.
- Permission-denied explanations based on action type.

### Frontend Validation

Product requirement:

- Required staff create fields must be validated before submit: `fullName`, `email`, `phoneNumber`, `gender`, and at least one `staffTypeId`.
- Phone number should guide users toward backend-compatible E.164 format.
- Date of birth can be empty; if present, frontend may validate adult age to match backend behavior.
- Staff type options should exclude or disable archived staff types if backend exposes `isArchived`.

Frontend decision:

- Frontend may warn or block when selected staff types all have `defaultRoleId: null`, depending on final product decision.
- Frontend may show a remediation step immediately after staff creation instead of forcing staff type setup before creation.

Frontend assumption about backend:

- Backend is the source of truth for whether a staff user has campus access. Frontend can inspect `defaultRoleId` and role assignment outcomes, but should not be the only enforcement point for access readiness.

### Business Rules Currently Assumed By Frontend

Product requirement:

- If a staff member is intended to log into the selected campus, the linked backend user must have a campus-scoped role for that campus.
- Staff profile membership and login campus access are separate concepts.
- Empty campus discovery should be treated as a valid no-access state, not only as a transport error.

Frontend decision:

- UI should explain `Not login-ready` or equivalent state using admin-facing copy rather than exposing internal table names.
- Staff type default-role configuration can be presented as a setup improvement for future staff creation.

Frontend assumption about backend:

- `StaffResponse.userId` is the backend user ID accepted by role assignment APIs.
- `StaffTypeResponse.defaultRoleId` is enough to predict whether future staff creation can auto-grant at least one campus role from that staff type.
- Role flags such as `isReadOnly`, `isSystemRole`, and `isSystemDefault` are sufficient for frontend to avoid invalid default-role candidates, but backend must still validate.

### Refresh Or Synchronization Expectations

Product requirement:

- After staff creation or role assignment, frontend needs to refresh staff list/detail data.
- If the affected user is the current user, frontend needs to refresh auth bootstrap and campus discovery.
- If mobile caches campus discovery, backend/frontend should agree whether re-auth, token refresh, or normal refetch is required.

Frontend assumption about backend:

- Role assignment is observable through a subsequent `GET /api/campuses` for the target user after the relevant auth/session refresh behavior is complete.
- Role assignment is synchronous from the caller's perspective unless backend states otherwise.

### Long-Running Operation Expectations

Frontend assumption about backend:

- Staff creation, staff create-or-attach, staff type default-role update, and role assignment are synchronous HTTP operations.
- No polling is expected unless backend introduces asynchronous access provisioning.

### Permission-Sensitive UI Behavior

Product requirement:

- Frontend must hide or disable actions based on known role permissions where possible, while still handling backend 401/403 responses.
- Role assignment should require an RBAC permission such as `role.assign` if backend enforces it.
- Staff type default role updates should require a staff type management permission such as `staff_type.update` if backend enforces it.
- Role list reads should require role read/list permission if backend enforces it.

Frontend assumption about backend:

- Backend remains authoritative for all permission decisions and can reject actions even if frontend UI allowed them.

## 3. Backend Needs / Assumptions

### Data The Frontend Needs

Confirmed requirement:

- Accessible campuses for the authenticated user.
- Staff types for the selected campus, including `defaultRoleId` and archived state.
- Staff creation/create-or-attach response with staff profile ID and backend `userId`.
- Campus roles for the selected campus, including mutability/read-only flags.
- Role assignment success/failure signal for assigning a campus role to a backend user.
- Staff type update response after changing `defaultRoleId`.

Frontend assumption:

- `userId` on the staff response is normally non-null after staff create/create-or-attach succeeds.
- If `userId` can be null, backend will document exactly when and how frontend should handle it.

Suggested backend capability:

- A backend-owned staff campus access status, for example `campusAccessStatus`, `hasCampusAccess`, or equivalent, available on staff detail/list/create responses or a dedicated access-check endpoint. Backend should evaluate the best shape.

### Actions The Frontend Needs To Perform

Confirmed requirement:

- Load campus discovery.
- Load staff types.
- Create or attach staff in the selected campus.
- Load roles for the selected campus.
- Assign an existing role to a staff user's backend `userId`.
- Configure `defaultRoleId` for a staff type if admin chooses future-proof setup.

Frontend assumption:

- Existing role assignment API can be used as a remediation path for already-created staff users with missing campus access.

Suggested backend capability:

- A one-step remediation endpoint for ensuring a staff user has campus access, if backend wants to centralize validation and reduce frontend orchestration.

### Existing APIs Frontend Believes May Be Reusable

- `GET /api/campuses`
- `GET /api/staff-types`
- `POST /api/staff`
- `POST /api/staff/create-or-attach`
- `GET /api/roles`
- `GET /api/roles/permissions/all`
- `POST /api/roles`
- `POST /api/roles/:id/users`
- `PATCH /api/staff-types/:id`
- `GET /api/auth/me`

### New APIs Frontend May Need

Suggested backend capability:

- Staff campus access status read, if existing staff/list/detail responses cannot reliably expose access readiness.
- Staff campus access remediation action, if backend wants a domain-specific flow instead of frontend directly assigning roles.
- Optional setup diagnostic endpoint for campus role/staff type readiness, if backend wants to aggregate role and staff type readiness for admin setup UI.

### Existing APIs That May Need Changes

Change requested for backend evaluation:

- Staff create/create-or-attach may need an explicit way to distinguish `profile created` from `profile created and login-ready`.
- Staff create/create-or-attach may need to return access readiness metadata or reject when frontend requests a login-ready staff user and no role grant can be made.
- Staff type list/detail may need to expose enough default-role candidate metadata for frontend to prevent invalid selections before submit.
- Role assignment may need documented idempotency/no-op behavior for duplicate submissions.

### Backend Behavior Assumed By Frontend

Frontend assumption:

- Campus discovery is role-based.
- Staff profile `campusId` alone does not grant login access.
- Staff type `defaultRoleId` controls future automatic role grants during staff creation/create-or-attach.
- Updating `defaultRoleId` is not retroactive unless backend adds a separate backfill behavior.
- Assigning a role to `StaffResponse.userId` should make the target user eligible for campus discovery after appropriate refresh.

### Permission Behavior Assumed By Frontend

Frontend assumption:

- Campus-scoped endpoints require `x-campus-id`.
- Role assignment requires a role assignment permission.
- Staff type default-role update requires a staff type update permission.
- Role reads/listing require role permissions.
- Backend can reject requests for missing campus context, archived campus, missing campus access, or missing RBAC permission.

### State Or Lifecycle Behavior Assumed By Frontend

Frontend assumption:

- Staff created without campus-scoped role is a valid backend state unless backend decides to forbid it for login-ready flows.
- Staff type default-role setup affects future creates only.
- Existing staff created before default roles were configured need manual assignment or a backend-provided backfill/remediation operation.
- Existing role assignments may be skipped/no-op when duplicate assignment is submitted.

### Consistency Or Refresh Behavior Assumed By Frontend

Frontend assumption:

- Role assignment and staff type update are visible in subsequent reads after the mutation response.
- Mobile/workspace campus discovery may require refetch or auth/session refresh; backend should confirm whether token claims are involved.
- If backend uses cached authorization material, backend should document stale windows or required refresh behavior.

## 4. Suggested API Contract

All API contracts in this section are integration proposals unless explicitly marked `Existing — verified`. Existing API details are based on current backend handoff docs and still need backend confirmation for the target branch/environment before implementation begins.

### 4.1 Discover Accessible Campuses

Status: Existing — verified by @doc/architecture/rbac-system.

Intended user action: User opens app or refreshes campus/workspace picker.

Proposed HTTP method: `GET`

Proposed endpoint: `/api/campuses`

Purpose: Return campuses the authenticated user can access.

Path parameters: none.

Query parameters:

- `limit?: number`
- `offset?: number`
- `sort?: string`
- `filter?: string`

Request payload: none.

Expected response shape:

```json
{
  "success": true,
  "message": "Campuses retrieved successfully",
  "data": {
    "data": [
      {
        "id": "uuid",
        "name": "Main Campus",
        "address": "string | null",
        "phoneNumber": "string | null",
        "isArchived": false,
        "createdAt": "ISO timestamp",
        "updatedAt": "ISO timestamp"
      }
    ],
    "pagination": {
      "count": 1,
      "limit": 10,
      "offset": 0,
      "totalPages": 1,
      "currentPage": 1,
      "hasNext": false,
      "hasPrev": false
    }
  },
  "timestamp": "ISO timestamp"
}
```

Fields required by the UI:

- `data.data[].id`
- `data.data[].name`
- `data.data[].isArchived`
- Pagination metadata if list can exceed one page.

Optional fields:

- `address`
- `phoneNumber`

Nullable fields:

- `address`
- `phoneNumber`

Expected status codes:

- `200` success, including empty list.
- `400` invalid query/filter.
- `401` unauthenticated.
- `403` authenticated user cannot be resolved or access context fails.

Validation errors frontend needs to handle:

- Invalid pagination/filter/sort values.

Permission errors:

- `401` and `403` must be distinguishable from empty campus list.

Not-found behavior:

- Not expected for this list endpoint unless backend defines otherwise.

Conflict behavior:

- Not expected.

Retryable failure behavior:

- Network errors and 5xx should be retryable.
- Empty `data.data: []` is not retryable by itself; it is a valid no-access state.

Pagination/filtering/sorting:

- Frontend assumes backend standard `limit`, `offset`, `sort`, and JSON `filter` conventions where supported.

### 4.2 List Staff Types For Selected Campus

Status: Existing — verified by @doc/architecture/rbac-system.

Intended user action: Admin opens staff create flow or staff type setup flow.

Proposed HTTP method: `GET`

Proposed endpoint: `/api/staff-types`

Purpose: Load staff types in the selected campus and inspect whether selected types have a default role.

Path parameters: none.

Query parameters:

- `limit?: number`
- `offset?: number`
- `sort?: string`
- `filter?: string`

Required headers:

- `x-campus-id: <campus UUID>`

Request payload: none.

Expected response item shape:

```json
{
  "id": "uuid",
  "campusId": "uuid",
  "name": "Teacher",
  "description": "string | null",
  "defaultRoleId": "uuid | null",
  "isArchived": false,
  "order": 1,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Fields required by the UI:

- `id`
- `name`
- `defaultRoleId`
- `isArchived`
- `campusId`

Optional fields:

- `description`
- `order`

Nullable fields:

- `description`
- `defaultRoleId`

Expected status codes:

- `200` success.
- `400` invalid/missing campus context or invalid query.
- `401` unauthenticated.
- `403` no campus access or missing permission.
- `404` campus not found.

Validation errors frontend needs to handle:

- Invalid campus ID.
- Invalid filter/sort field.

Permission errors:

- Missing staff type list permission should produce a distinguishable `403`.

Not-found behavior:

- Campus not found should be distinguishable from empty staff type catalog.

Conflict behavior:

- Not expected.

Retryable failure behavior:

- Network errors and 5xx retryable.
- Permission and validation failures are not retryable without state/user changes.

Pagination/filtering/sorting:

- Frontend needs pagination metadata if response is paginated.
- Frontend can use filtering/sorting only after backend confirms supported fields.

### 4.3 Create Or Attach Staff

Status: Existing — needs backend confirmation for target branch/environment. The frontend spec references `POST /api/staff/create-or-attach`, and @doc/specs/2026-07-01/staff-multi-campus-existing-account documents it. @doc/architecture/rbac-system focuses on `POST /api/staff` and the current `No Campus` issue, so backend should confirm which staff creation endpoint frontend should use for this feature.

Intended user action: Admin submits staff creation form.

Proposed HTTP method: `POST`

Proposed endpoint: `/api/staff/create-or-attach`

Purpose: Create a target-campus staff profile by creating a new identity or attaching an eligible existing identity.

Path parameters: none.

Query parameters: none.

Required headers:

- `x-campus-id: <campus UUID>`

Request payload:

```json
{
  "fullName": "Dana Nguyen",
  "email": "dana.nguyen@example.com",
  "phoneNumber": "+14165550123",
  "gender": "FEMALE",
  "staffTypeIds": ["uuid"],
  "address": "123 Main Street",
  "dateOfBirth": "1990-01-15T00:00:00.000Z"
}
```

Fields required by the UI:

- Request: `fullName`, `email`, `phoneNumber`, `gender`, `staffTypeIds`.
- Response: `resultStatus`, `staff.id`, `staff.campusId`, `staff.fullName`, `staff.staffTypes`, `staff.userId`, `staff.isArchived`.

Optional fields:

- Request: `address`, `dateOfBirth`.
- Response: `staff.address`, `staff.dateOfBirth`, `staff.staffCode`.

Nullable fields:

- `staff.userId` is nullable in some documented shapes, but frontend needs backend confirmation whether it can be null after create/create-or-attach success.
- `address`, `dateOfBirth`, and other profile fields may be null.

Expected response shape:

```json
{
  "success": true,
  "message": "Staff create-or-attach completed successfully",
  "data": {
    "resultStatus": "CREATED_NEW_STAFF | ATTACHED_EXISTING_IDENTITY | ALREADY_EXISTS_IN_CAMPUS | RESTORED_EXISTING_STAFF",
    "staff": {
      "id": "uuid",
      "campusId": "uuid",
      "staffCode": "ST-2026-000043",
      "fullName": "Dana Nguyen",
      "email": "dana.nguyen@example.com",
      "phoneNumber": "+14165550123",
      "staffTypes": [{ "id": "uuid", "name": "Teacher" }],
      "address": "string | null",
      "dateOfBirth": "ISO timestamp | null",
      "gender": "MALE | FEMALE | OTHER | null",
      "userId": "uuid | null",
      "isArchived": false,
      "createdAt": "ISO timestamp",
      "updatedAt": "ISO timestamp"
    }
  },
  "timestamp": "ISO timestamp"
}
```

Change requested for backend evaluation:

- Add or document an explicit access-readiness signal in the response, for example `staffCampusAccess`, `hasCampusAccess`, `accessStatus`, or a separate endpoint. Frontend should not be forced to infer critical access readiness only from selected `staffTypeIds` and role assignment side effects.
- Consider an optional frontend-controlled intent such as `requireCampusAccess: true` or equivalent. If backend accepts such an intent, it should either create/attach a login-ready staff user or reject with a clear validation/setup error. This is a product/API design question, not a required backend implementation design.

Expected status codes:

- `200` or `201` success; backend should confirm exact code.
- `400` validation failure.
- `401` unauthenticated.
- `403` no campus access or missing permission.
- `404` campus or staff type not found.
- `409` identity conflict, duplicate profile, ambiguous identity, or backend-defined conflict.

Validation errors frontend needs to handle:

- Missing/invalid required fields.
- Invalid email/phone/gender/date of birth.
- Empty or invalid `staffTypeIds`.
- Staff type archived or in another campus.
- Missing `x-campus-id`.
- Optional access-readiness validation failure if backend adds it.

Permission errors:

- Missing campus access.
- Missing staff creation permission if backend adds/enforces one.

Not-found behavior:

- Campus not found.
- Staff type not found.

Conflict behavior:

- Existing identity conflict codes from identity/profile split should remain stable enough for neutral frontend copy.
- Backend should confirm whether `ALREADY_EXISTS_IN_CAMPUS` is a success response or a `409` in the target endpoint.

Retryable failure behavior:

- Network errors and 5xx are retryable only when frontend cannot determine whether mutation succeeded. Backend should confirm idempotency or duplicate-safe behavior for repeated create-or-attach submissions.

Pagination/filtering/sorting:

- Not applicable.

### 4.4 Create Staff Legacy Endpoint

Status: Existing — verified by @doc/architecture/rbac-system, but needs backend confirmation whether frontend should continue using it for this feature.

Intended user action: Admin submits staff creation form where create-or-attach is unavailable or intentionally out of scope.

Proposed HTTP method: `POST`

Proposed endpoint: `/api/staff`

Purpose: Create a staff profile and backend user in the selected campus.

Path parameters: none.

Query parameters: none.

Required headers:

- `x-campus-id: <campus UUID>`

Request payload:

```json
{
  "fullName": "Dana Nguyen",
  "email": "dana.nguyen@example.com",
  "phoneNumber": "+14165550123",
  "gender": "FEMALE",
  "staffTypeIds": ["uuid"],
  "address": "123 Main Street",
  "dateOfBirth": "1990-01-15"
}
```

Fields required by the UI:

- Same create fields as create-or-attach.
- Response `userId` for possible role assignment remediation.

Expected response shape:

```json
{
  "id": "uuid",
  "campusId": "uuid",
  "staffCode": "ST-2026-000002",
  "fullName": "Dana Nguyen",
  "email": "dana.nguyen@example.com",
  "phoneNumber": "+14165550123",
  "staffTypes": [{ "id": "uuid", "name": "Teacher" }],
  "address": "string | null",
  "dateOfBirth": "ISO timestamp | null",
  "gender": "MALE | FEMALE | OTHER | null",
  "userId": "uuid | null",
  "isArchived": false,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Change requested for backend evaluation:

- If this endpoint remains in use, backend should document whether staff creation can be considered login-ready, not login-ready, or conditionally ready based on default-role grants.
- Backend should confirm whether frontend should migrate to create-or-attach instead of this endpoint.

Status codes, validation, permission, not-found, conflict, retry, pagination/filtering/sorting:

- Same as documented in @doc/architecture/rbac-system unless backend revises the contract.

### 4.5 List Campus Roles

Status: Existing — verified by @doc/architecture/rbac-system and @doc/specs/2026-06-26/rbac-admin-management-api-hardening.

Intended user action: Admin chooses a role for staff access remediation or configures staff type default role.

Proposed HTTP method: `GET`

Proposed endpoint: `/api/roles`

Purpose: List roles in the selected campus, including metadata needed to select valid mutable campus roles.

Path parameters: none.

Query parameters:

- `limit?: number`
- `offset?: number`
- `sort?: string`
- `filter?: string`

Required headers:

- `x-campus-id: <campus UUID>`

Expected response item shape:

```json
{
  "id": "uuid",
  "name": "Teacher",
  "description": "string | null",
  "campusId": "uuid | null",
  "isSystemDefault": false,
  "isSystemRole": false,
  "isReadOnly": false,
  "permissions": [
    {
      "id": "student.read",
      "module": "student",
      "description": "string | null",
      "createdAt": "ISO timestamp"
    }
  ],
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Fields required by the UI:

- `id`
- `name`
- `campusId`
- `isReadOnly`
- `isSystemRole`
- `isSystemDefault`
- Permission summary if frontend displays it.

Optional fields:

- `description`
- `permissions`

Nullable fields:

- `description`
- `campusId` may be null for global/system roles.

Expected status codes:

- `200` success.
- `400` invalid campus/query/filter.
- `401` unauthenticated.
- `403` no campus access or missing permission.
- `404` campus not found.

Validation errors frontend needs to handle:

- Invalid filters/sorts.
- Invalid campus context.

Permission errors:

- Missing role list/read permission.

Not-found behavior:

- Campus not found.

Conflict behavior:

- Not expected for list.

Retryable failure behavior:

- Network and 5xx retryable.

Pagination/filtering/sorting:

- Frontend needs backend to confirm supported sort and filter fields for role picker/search.

### 4.6 Assign Existing Role To Staff User

Status: Existing — verified by @doc/architecture/rbac-system.

Intended user action: Admin fixes a staff user who was created/attached without campus access.

Proposed HTTP method: `POST`

Proposed endpoint: `/api/roles/:id/users`

Purpose: Grant a campus-scoped role to one or more backend user IDs.

Path parameters:

- `id`: role ID.

Query parameters: none.

Required headers:

- `x-campus-id: <campus UUID>`

Request payload:

```json
{
  "userIds": ["uuid"]
}
```

Expected response shape:

```json
{
  "success": true,
  "message": "Users assigned successfully",
  "data": null,
  "timestamp": "ISO timestamp"
}
```

Fields required by the UI:

- Success/failure signal.
- Backend message.

Optional fields:

- If backend returns assignment details in future, frontend can display them, but current frontend should not require a rich body.

Nullable fields:

- `data` may be null or omitted; backend should confirm exact wrapper behavior.

Expected status codes:

- `201` success or no-op for already assigned users, per existing handoff.
- `400` invalid role/campus/payload.
- `401` unauthenticated.
- `403` no campus access or missing `role.assign` permission.
- `404` role or target user not found.

Validation errors frontend needs to handle:

- Invalid role ID.
- Invalid or empty `userIds`.
- Role belongs to another campus.
- Role is not assignable.

Permission errors:

- Missing role assignment permission.

Not-found behavior:

- Role not found.
- Target backend user not found.

Conflict behavior:

- Backend should confirm whether duplicate role assignment is a success/no-op or conflict. Current handoff says existing assignments are skipped.

Retryable failure behavior:

- Network/5xx retryable if frontend can safely repeat assignment.
- Backend should confirm idempotency semantics for duplicate retries.

Pagination/filtering/sorting:

- Not applicable.

### 4.7 Update Staff Type Default Role

Status: Existing — verified by @doc/architecture/rbac-system.

Intended user action: Admin configures a staff type so future staff creation grants campus access automatically.

Proposed HTTP method: `PATCH`

Proposed endpoint: `/api/staff-types/:id`

Purpose: Set or clear `defaultRoleId` for a staff type.

Path parameters:

- `id`: staff type ID.

Query parameters: none.

Required headers:

- `x-campus-id: <campus UUID>`

Request payload:

```json
{
  "defaultRoleId": "uuid | null"
}
```

Expected response item shape:

```json
{
  "id": "uuid",
  "campusId": "uuid",
  "name": "Teacher",
  "description": "string | null",
  "defaultRoleId": "uuid | null",
  "isArchived": false,
  "order": 1,
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

Fields required by the UI:

- `id`
- `name`
- `defaultRoleId`
- `campusId`
- `isArchived`

Optional fields:

- `description`
- `order`

Nullable fields:

- `description`
- `defaultRoleId`

Expected status codes:

- `200` success.
- `400` invalid default role or validation failure.
- `401` unauthenticated.
- `403` no campus access or missing staff type update permission.
- `404` staff type or role not found.
- `409` duplicate/conflicting staff type state where backend defines it.

Validation errors frontend needs to handle:

- `defaultRoleId` is not a role in the selected campus.
- Role is system/default/read-only/global and not valid as a default role.
- Staff type archived or not mutable, if backend enforces that.

Permission errors:

- Missing `staff_type.update` or equivalent.

Not-found behavior:

- Staff type not found.
- Role not found.

Conflict behavior:

- Backend should document exact conflicts for staff type update.

Retryable failure behavior:

- Network/5xx retryable if latest staff type state is refetched after retry/failure.

Pagination/filtering/sorting:

- Not applicable for mutation.

### 4.8 Read Staff Campus Access Status

Status: Proposed.

Intended user action: Admin opens staff list/detail or completes staff creation and needs to know whether the staff user can access the selected campus.

Proposed HTTP method: Backend should evaluate. Possible options:

- Include status on existing staff list/detail/create responses.
- `GET /api/staff/:id/access`.
- `GET /api/staff/:id/campus-access`.

Proposed endpoint: To be decided by backend.

Purpose: Provide a backend-owned answer for access readiness instead of forcing frontend to infer from staff type default roles, local role list, and prior mutation outcomes.

Path parameters:

- `staffId` if using a dedicated staff endpoint.

Query parameters:

- None expected if campus context comes from `x-campus-id`.

Required headers:

- `x-campus-id: <campus UUID>` for campus-scoped access status.

Request payload: none.

Expected response shape proposal:

```json
{
  "staffId": "uuid",
  "userId": "uuid | null",
  "campusId": "uuid",
  "hasCampusAccess": true,
  "accessStatus": "READY | MISSING_USER | MISSING_CAMPUS_ROLE | STAFF_ARCHIVED | CAMPUS_ARCHIVED | UNKNOWN",
  "roleAssignments": [
    {
      "roleId": "uuid",
      "roleName": "Teacher",
      "source": "manual | staff_type | unknown"
    }
  ],
  "checkedAt": "ISO timestamp"
}
```

Fields required by the UI:

- `hasCampusAccess` or equivalent boolean.
- Stable status/code that distinguishes missing role from missing user/profile/campus issues.
- `userId` if the next remediation action needs it.

Optional fields:

- Role assignment details.
- Human-readable backend message.

Nullable fields:

- `userId` may be null if backend supports profiles without linked users.
- `roleAssignments` can be empty.

Expected status codes:

- Backend should define.
- Frontend expects `200`, `400`, `401`, `403`, `404`, and 5xx categories to be distinguishable.

Validation errors frontend needs to handle:

- Invalid staff ID.
- Missing campus context.

Permission errors:

- Backend should decide whether this requires staff read, role read, both, or another permission.

Not-found behavior:

- Staff profile not found in selected campus.

Conflict behavior:

- Not expected unless backend identifies inconsistent state.

Retryable failure behavior:

- Network/5xx retryable.
- State statuses such as `MISSING_CAMPUS_ROLE` are not retryable without remediation.

Pagination/filtering/sorting:

- Not applicable for detail status.

### 4.9 Ensure Staff Campus Access

Status: Proposed.

Intended user action: Admin clicks a remediation action after staff creation or from staff detail.

Proposed HTTP method: Backend should evaluate. Possible method: `POST`.

Proposed endpoint: Backend should evaluate. Possible endpoint: `/api/staff/:id/ensure-campus-access`.

Purpose: Backend-owned remediation that grants or verifies campus access for a staff profile using a selected role or backend-chosen default policy.

Path parameters:

- `id`: staff profile ID.

Query parameters: none expected.

Required headers:

- `x-campus-id: <campus UUID>`.

Request payload proposal:

```json
{
  "roleId": "uuid"
}
```

Alternative payload if backend wants an intent-based flow:

```json
{
  "mode": "assign_role | use_staff_type_default | backend_default",
  "roleId": "uuid | optional"
}
```

Expected response shape proposal:

```json
{
  "staffId": "uuid",
  "userId": "uuid",
  "campusId": "uuid",
  "hasCampusAccess": true,
  "accessStatus": "READY",
  "assignedRoleIds": ["uuid"],
  "wasAlreadyReady": false
}
```

Fields required by the UI:

- Success/failure signal.
- Whether the user is now campus-access ready.
- Whether the operation was a no-op/already ready.

Optional fields:

- Assigned role IDs or role names.

Nullable fields:

- `assignedRoleIds` may be empty if already ready.

Expected status codes:

- Backend should define.
- Frontend expects success, validation, unauthorized, permission denied, not found, conflict, and retryable server failure categories.

Validation errors frontend needs to handle:

- Invalid role.
- Role belongs to another campus.
- Role is not assignable.
- Staff has no linked backend user.
- Staff is archived, if backend blocks remediation.

Permission errors:

- Backend should define whether this maps to `role.assign`, `staff.update`, a new permission, or multiple permissions.

Not-found behavior:

- Staff not found.
- Role not found.
- Linked user not found.

Conflict behavior:

- Concurrent role changes.
- Staff archived or campus archived during operation.
- Already ready could be success/no-op rather than conflict; backend should decide.

Retryable failure behavior:

- Should be idempotent or duplicate-safe if frontend retries after network uncertainty.

Pagination/filtering/sorting:

- Not applicable.

## 5. Frontend Data Requirements

| Field / data | Why frontend needs it | Required | Current assumption |
| ------------ | --------------------- | -------- | ------------------ |
| `campus.id` | Send `x-campus-id`, key cache, show selected campus, scope staff/RBAC calls. | Required; expected from backend; backend-owned. | Existing `GET /api/campuses` returns it. |
| `campus.name` | Display campus picker/current campus. | Required for UI display; expected from backend. | Existing campus discovery returns it. |
| `campus.isArchived` | Avoid or explain unavailable archived campuses. | Required if archived campuses can appear; expected from backend. | Existing campus response includes it. |
| Campus discovery empty result | Distinguish no campus access from request failure. | Required signal; expected from backend via empty list. | Empty `data.data` means no discoverable campus. |
| `staffType.id` | Submit selected staff type IDs. | Required; expected from backend. | Existing staff type list returns it. |
| `staffType.name` | Display selectable staff type and status copy. | Required for UI display; expected from backend. | Existing staff type list returns it. |
| `staffType.defaultRoleId` | Detect whether selected staff type can auto-grant campus role for future staff creation. | Required for access-readiness UX; expected from backend; nullable. | Null means no default role from that staff type. |
| `staffType.isArchived` | Prevent selecting archived staff types. | Required if archived staff types can be listed; expected from backend. | Backend rejects archived staff types. |
| `staff.id` | Navigate to staff detail and perform profile-scoped actions. | Required; expected from backend. | Staff create/create-or-attach returns it. |
| `staff.campusId` | Confirm response belongs to selected campus and show profile ownership. | Required; expected from backend; backend-owned. | Not sufficient for login access. |
| `staff.userId` | Assign role to linked backend user; identify access target. | Required for remediation; expected from backend; nullable in schema. | Normal create/create-or-attach should return a value; backend must confirm null cases. |
| `staff.staffTypes` | Show resulting staff type names after create/attach/restore. | Required for display; expected from backend. | Backend response is source of truth. |
| `staff.isArchived` | Disable/remediate differently for archived profile. | Required for lifecycle UI; expected from backend. | Backend owns profile lifecycle state. |
| `resultStatus` | Show correct create-or-attach success copy and navigation behavior. | Required if using create-or-attach; expected from backend. | Values documented in identity/profile split spec. |
| `role.id` | Assign role to user or set staff type default role. | Required; expected from backend. | Existing role list returns it. |
| `role.name` | Display role picker and remediation copy. | Required for UI display; expected from backend. | Existing role list returns it. |
| `role.campusId` | Confirm role is campus-scoped candidate. | Required for safe UI filtering; expected from backend; nullable. | Null may indicate global/system role. Backend remains authoritative. |
| `role.isReadOnly` | Hide/disable mutation or default-role selection for read-only roles. | Required; expected from backend. | Frontend should use flag, not role name. |
| `role.isSystemRole` | Avoid invalid staff type default role candidates. | Required; expected from backend. | Backend validates anyway. |
| `role.isSystemDefault` | Avoid invalid staff type default role candidates. | Required; expected from backend. | Backend validates anyway. |
| `role.permissions` | Optional summary in picker/detail and permission-sensitive explanation. | Optional for remediation picker; expected from backend when role list includes it. | Frontend can avoid displaying deep permission details if absent. |
| Current user's permissions | Hide/disable unavailable UI actions. | Required for UX gating; expected from auth/campus context. | Backend still enforces permissions. |
| Backend error `message` | Display actionable validation/conflict/permission errors. | Required; expected from backend. | Existing API wrapper includes message. |
| Backend error `code` | Map identity/access conflicts to stable neutral copy. | Optional but strongly preferred; expected where already documented. | Frontend handles absence by falling back to message/status. |
| `hasCampusAccess` or access status | Show whether staff is login-ready for campus. | Suggested backend capability; expected backend-owned if added. | Frontend should not derive business-critical access truth alone. |
| Role assignment success/no-op signal | Confirm remediation completed. | Required; expected from backend response status/message. | Existing API may return no rich body. |
| Pagination metadata | Render paginated role/staff type/campus lists. | Required where backend paginates; expected from backend. | Standard wrapper uses `pagination`. |
| Supported filters | Server-side search/filter. | Optional; expected from backend docs. | Frontend should only use confirmed fields. |
| Supported sorts | Server-side sorting. | Optional; expected from backend docs. | Frontend should only use confirmed fields. |
| Processing/pending state | Show async progress if backend adds long-running provisioning. | Optional; expected only if backend changes operation to async. | Current assumption is synchronous. |

## 6. User Action To Backend Need Mapping

| User action | Frontend behavior | Backend capability needed | Assumption / question |
| ----------- | ----------------- | ------------------------- | --------------------- |
| Open staff management | Load selected campus context and staff prerequisites. | `GET /api/campuses`, staff list/detail if needed, campus context support. | Is empty campus discovery always no role access, or can profile-only access affect it later? |
| Open staff create dialog | Load staff types and possibly role readiness data. | `GET /api/staff-types`, optional `GET /api/roles`. | Are archived staff types returned, filtered, or only rejected on submit? |
| Select staff type | Show whether selected type has a default role. | `defaultRoleId` on staff type response. | Does non-null `defaultRoleId` always mean future staff creation grants access, or can role be invalid/stale? |
| Submit create staff | Create or attach staff profile in selected campus. | `POST /api/staff/create-or-attach` or `POST /api/staff`. | Which endpoint should frontend use for this feature? |
| Show create result | Branch success copy and navigation. | `resultStatus` and `staff` response. | Are `ALREADY_EXISTS_IN_CAMPUS` and restore states success responses in target backend? |
| Determine login readiness | Show ready/not-ready state. | Backend-owned access status, or documented role assignment semantics. | Should backend return access readiness directly? |
| Assign campus role | Submit backend `userId` to role assignment. | `POST /api/roles/:id/users`. | Is duplicate assignment always a success/no-op? |
| Configure staff type default role | Set role for future auto-grants. | `PATCH /api/staff-types/:id`. | Should backend provide a bulk/backfill option for existing staff? |
| Create missing role | Create mutable campus role if no valid role exists. | `POST /api/roles`; optional permissions catalog. | Should staff access remediation allow roles with empty permissions? Product/backend decision needed. |
| Refresh after role assignment | Refetch status/campuses/staff data. | Consistent subsequent reads; auth/session refresh guidance. | Does mobile need re-login or token refresh? |
| Retry failed assignment | Repeat safely after network failure. | Idempotent or duplicate-safe role assignment. | Backend should confirm retry semantics. |
| Filter role picker | Query or client-filter roles. | Confirmed role filter fields or complete role list. | Which filters are supported for name/mutability? |
| Sort role picker/list | Render predictable role order. | Confirmed role sort fields. | Is `name` supported everywhere? |
| Change page | Load next server page. | Pagination metadata and stable paging. | Offset-based is assumed from existing docs. |
| Handle `No Campus` | Show no-access/setup message. | Empty campus discovery plus optional reason. | Can backend distinguish no role assignment from other no-campus causes? |

## 7. UI State To Backend Requirement Mapping

| Frontend state | Data / backend signal needed | Current frontend assumption |
| -------------- | ---------------------------- | --------------------------- |
| Loading | Pending request state only. | Frontend controls spinner/skeleton. |
| Empty campus list | `GET /api/campuses` returns empty paginated list. | Means authenticated user has no discoverable campus through current role assignments. |
| Empty staff type catalog | `GET /api/staff-types` returns empty list. | Staff creation cannot proceed until staff types exist or backend supports another path. |
| No default-role staff types | Staff types all have `defaultRoleId: null`. | Staff creation may succeed but not be login-ready unless role assigned separately. |
| Empty role catalog | `GET /api/roles` returns no mutable campus roles. | Role remediation/default-role setup is blocked until a role exists. |
| Staff creation success | Staff response includes `staff.id` and preferably `staff.userId`. | Success does not necessarily mean login-ready unless backend says so. |
| Created and login-ready | Backend returns access status or frontend confirms role assignment/default grant. | Backend should be source of truth if possible. |
| Created but not login-ready | Missing campus-scoped role signal or access status. | Valid setup state unless backend rejects login-required creates. |
| Validation error | 400 with field/message/code detail. | User can correct input. |
| Unauthorized | 401. | User must sign in or refresh auth. |
| Permission denied | 403 with message/code. | User lacks campus access or action permission. |
| Not found | 404 for campus/staff type/role/user. | Data may be stale; frontend should refetch relevant lists. |
| Conflict | 409 with message/code. | Duplicate identity, ambiguous identity, role/staff type conflict, or concurrent state change. |
| Pending/processing | Explicit status if backend introduces async operation. | Current flow assumes synchronous operations. |
| Partial success | Backend response must identify which part succeeded. | Current existing role assignment appears transactional; no partial success expected. |
| Retryable failure | Network/5xx or timeout. | Retry only if backend operation is idempotent or duplicate-safe. |
| Fatal failure | Backend code/status indicates non-retryable invalid state. | User/admin must change setup or permissions. |
| Completed | Success response plus refreshed reads. | Frontend considers flow complete when backend read confirms desired state or mutation succeeds by contract. |

## 8. Questions For Backend

1. Which staff creation endpoint should frontend use for this feature: `POST /api/staff`, `POST /api/staff/create-or-attach`, or both under different conditions?
2. Is `POST /api/staff/create-or-attach` available in the target backend branch/environment for this work?
3. Should a staff create/create-or-attach request intended for a login-capable staff user fail if no selected staff type can grant a campus role?
4. Should backend add an explicit request intent such as `requireCampusAccess`, or should frontend perform remediation after create?
5. Can backend return a staff campus access status so frontend does not infer RBAC readiness from local data?
6. What is the exact source of truth for `No Campus`: role assignments only, active staff profile plus role assignment, auth token claims, or another access model?
7. After assigning a role, when should `GET /api/campuses` reflect the new campus for the target user?
8. Does mobile need token refresh, auth bootstrap refresh, or full re-login after role assignment?
9. Can `StaffResponse.userId` be null after successful staff create/create-or-attach? If yes, what frontend state should be shown?
10. Is role assignment to an already assigned user idempotent success/no-op in all cases?
11. What permission(s) should gate role assignment remediation from the staff create flow?
12. What permission(s) should gate staff type default-role configuration?
13. Should staff type default-role setup be allowed from the staff create flow, or only from staff type/RBAC settings?
14. Can a role with no permissions be a valid campus access role, or should backend require minimum permissions for login-ready access?
15. Are `isReadOnly`, `isSystemRole`, and `isSystemDefault` sufficient frontend signals to filter invalid default-role candidates?
16. Are staff type default-role grants applied during `POST /api/staff`, `POST /api/staff/create-or-attach`, restore, and staff type update flows consistently?
17. Does updating `defaultRoleId` ever backfill existing staff, or is backfill/remediation always separate?
18. Should backend provide a bulk backfill action for existing staff of a staff type?
19. How should backend represent identity conflicts for create-or-attach: status codes, stable `code` values, and messages?
20. Are staff creation and role assignment synchronous and transactionally complete when the HTTP response returns?
21. What happens during concurrent role assignment and staff archive/restore operations?
22. Is staff role assignment allowed for archived staff profiles?
23. Is role assignment allowed when the target campus is archived?
24. What exact filters/sorts are supported for staff types and roles in this workflow?
25. Are there migration/backward compatibility constraints for existing staff created before default roles were configured?
26. Should backend expose a diagnostic reason for empty campus discovery, or is a generic empty list intentionally all frontend gets?
27. Should backend document a recommended recovery path for current local/debug cases where staff exists with zero role assignments?

## 9. Risks / Dependencies

| Risk / dependency | Frontend work affected | Backend decision or research needed | Blocks frontend implementation |
| ----------------- | ---------------------- | ----------------------------------- | ------------------------------ |
| Staff create endpoint uncertainty | Staff create service/hook integration and result handling. | Confirm `POST /api/staff` vs `POST /api/staff/create-or-attach` for target feature. | Yes for final integration. |
| Login-ready invariant unclear | Warning/block/remediation UX after staff creation. | Decide whether backend rejects non-login-ready creates, returns access status, or allows separate remediation. | Partially; frontend can scaffold with assumptions but not finalize. |
| Access status missing | Staff list/detail readiness display. | Decide whether backend will expose access status or require frontend inference. | Blocks accurate status UI. |
| Permission model unclear for remediation | Visibility and disabled state of assign/default-role controls. | Confirm permissions for role assignment and staff type update. | Partially; backend 403 handling can be generic initially. |
| Refresh behavior unclear | Post-assignment mobile/workspace verification. | Confirm whether refetch is enough or auth/session refresh/re-login is required. | Blocks reliable end-to-end verification. |
| Existing staff with missing roles | Admin remediation and migration support. | Decide whether manual role assignment, bulk backfill, or staff-type-based backfill is expected. | Does not block basic UI, blocks migration UX. |
| Role candidate validity | Role picker filtering and staff type default-role selection. | Confirm valid role flags and validation rules. | Partially. |
| Duplicate/retry semantics | Retry behavior after network failures. | Confirm idempotency for role assignment and create-or-attach. | Blocks polished retry UX. |
| Identity conflict codes | Create-or-attach error copy. | Confirm stable error `code` values and status codes. | Partially; can fallback to backend message. |
| Empty campus diagnostic | Mobile `No Campus` explanation. | Decide whether backend exposes reason or intentionally returns only empty list. | Does not block basic empty state, blocks precise diagnostics. |
| Existing docs appear to cover overlapping contracts | Source-of-truth selection. | Backend should reconcile current `staff-campus-access` and `staff-multi-campus-existing-account` handoffs for this feature. | Yes for avoiding wrong endpoint integration. |
| Long-running operation uncertainty | Polling/progress UI. | Confirm operations remain synchronous. | No if current sync behavior remains. |
| Pagination/filter/sort support | Role/staff type picker scale. | Confirm supported fields and pagination behavior. | No for small lists, yes for scalable implementation. |

## 10. Acceptance Criteria From Frontend Perspective

Backend work unblocks frontend integration when the following are true:

- Backend confirms the canonical staff creation endpoint for this feature.
- The selected staff creation endpoint returns `staff.id`, `staff.campusId`, `staff.staffTypes`, and the backend `userId` or documents nullable `userId` handling.
- Backend documents whether staff creation success means login-ready, potentially login-ready, or profile-only success.
- Backend either exposes staff campus access readiness directly or confirms the exact frontend-safe way to infer it.
- Backend confirms how to remediate existing staff with no campus-scoped role.
- Backend confirms whether `POST /api/roles/:id/users` is the supported remediation API or provides a preferred domain-specific alternative.
- Backend confirms valid role candidate rules for staff type `defaultRoleId` and direct assignment.
- Backend confirms permission requirements for reading roles, assigning roles, reading/updating staff types, and creating staff.
- Backend confirms empty `GET /api/campuses` behavior and any available diagnostic reason.
- Backend confirms refresh/session behavior after role assignment, especially for mobile campus discovery.
- Backend documents relevant validation, not-found, conflict, and permission errors with stable status codes/messages/codes where possible.
- Backend confirms pagination, filtering, and sorting support for role and staff type reads used by this workflow.
- Backend confirms idempotency or retry behavior for create-or-attach and role assignment.
- Backend documents any migration/backfill expectation for staff created before default roles were configured.

Frontend can verify the backend contract by:

1. Creating/attaching staff with a staff type that has `defaultRoleId` and confirming the target user can discover the campus.
2. Creating/attaching staff with staff types that have no `defaultRoleId` and confirming backend returns the expected status/error/remediation path.
3. Assigning a campus role to the returned `staff.userId` and confirming campus discovery updates according to documented refresh behavior.
4. Setting a staff type `defaultRoleId`, creating another staff member, and confirming the documented automatic grant behavior.
5. Exercising 400, 401, 403, 404, and 409 cases enough for frontend to map states correctly.
6. Verifying role/staff type pagination/filter/sort behavior only for fields backend confirms.

## 11. Backend Research Checklist

- [ ] Inspect existing `GET /api/campuses` behavior and confirm source of truth for campus discovery.
- [ ] Inspect `POST /api/staff` and confirm whether frontend should still use it for this feature.
- [ ] Inspect `POST /api/staff/create-or-attach` availability and confirm exact result statuses and errors.
- [ ] Inspect staff creation/create-or-attach role grant behavior from staff type `defaultRoleId`.
- [ ] Confirm whether `StaffResponse.userId` can be null after successful create/create-or-attach.
- [ ] Inspect `GET /api/staff-types` fields and confirm `defaultRoleId`, `isArchived`, pagination, filters, and sorting.
- [ ] Inspect `PATCH /api/staff-types/:id` validation and permission behavior for `defaultRoleId`.
- [ ] Inspect `GET /api/roles` fields and confirm valid role candidate flags.
- [ ] Inspect `POST /api/roles/:id/users` validation, permission, idempotency, and response shape.
- [ ] Confirm whether role assignment updates campus discovery immediately after normal refetch or requires auth/session refresh.
- [ ] Confirm whether backend can or should expose staff campus access status.
- [ ] Decide whether a domain-specific `ensure staff campus access` capability is preferable to direct role assignment from frontend.
- [ ] Confirm whether backend should reject login-required staff creation when no campus role can be granted.
- [ ] Confirm whether roles with empty permissions count as valid campus access roles.
- [ ] Confirm current error code/message/status behavior for identity conflicts, invalid staff types, invalid roles, duplicate email/phone, and permission denial.
- [ ] Confirm concurrency behavior for duplicate create/attach submissions and duplicate role assignments.
- [ ] Confirm behavior when staff or campus is archived during remediation.
- [ ] Confirm whether existing staff created before default roles need a migration, bulk backfill, manual remediation, or no backend action.
- [ ] Reconcile overlapping backend handoff docs for staff campus access and staff multi-campus existing account support.
- [ ] Define blocking decisions for frontend: canonical create endpoint, access readiness source, remediation path, permission rules, and refresh behavior.
