---
title: RBAC Admin Management API Hardening
description: Specification for production-hardening and frontend-ready RBAC role, permission, and membership management APIs.
createdAt: '2026-06-26T23:54:20.228Z'
updatedAt: '2026-06-26T23:57:27.237Z'
tags:
  - spec
  - approved
  - rbac
  - api
  - security
  - frontend-ready
---

## Overview

Production-harden the RBAC admin management API so the frontend can safely manage roles, role permissions, and role membership across the multi-campus system.

The current RBAC foundations are reusable: permission catalog seeding, role-permission joins, campus-scoped user role assignments, `PermissionsGuard`, `CampusGuard`, and `/auth/me` permission exposure. This spec closes the management API gaps found during research: missing permission guards on role endpoints, ambiguous campus/global surfaces, role creation ID mismatch, incomplete list response shape, system-role mutability risk, and missing audit coverage for role/permission mutations.

Related context:
- @doc/architecture/rbac-system
- @doc/patterns/guards-pattern
- @doc/patterns/decorators-pattern
- @doc/guides/pagination-and-filtering

## Locked Decisions

- D1: Build a full admin management API. System roles such as Super Admin are visible for admin/audit clarity but read-only through normal role, permission, and membership management APIs.
- D2: RBAC management authorization is permission-based using `role.list`, `role.read`, `role.create`, `role.update`, `role.delete`, and `role.assign`; campus access is required for campus-scoped operations.
- D3: Normal RBAC management is campus-scoped. Separate explicit global/audit endpoints exist for system-wide inspection.
- D4: Role permission management supports both incremental add/remove and atomic replace-all mutation.
- D5: Membership APIs expose assignment provenance, and admin revoke may override/remove both manual and StaffType-derived grants for the selected user-role-campus pair.
- D6: RBAC admin API requires full mutation audit coverage: role create/update/delete, permission changes, and membership changes all emit audit events.

## Requirements

### Functional Requirements

- FR-1: The API must expose campus-scoped role management for frontend admin workflows: list roles for a campus, view role detail, create a campus role, update a campus role, delete a campus role, view role permissions, update role permissions, list role members, grant role membership, and revoke role membership.
- FR-2: The API must expose explicit global/audit read endpoints for system-wide inspection of roles, system roles, permissions, and assignments. These endpoints must not be reached accidentally through normal campus-scoped views.
- FR-3: Every role management endpoint must enforce `ClerkAuthGuard` plus the required `role.*` permission. Campus-scoped endpoints must also enforce validated campus access using `x-campus-id` or an explicit campus route parameter.
- FR-4: System roles and system-default roles must be returned with clear read-only metadata and must reject create/update/delete, permission mutation, and membership grant/revoke through normal management APIs.
- FR-5: Role creation must work with the database schema and must not generate non-UUID IDs for UUID-backed role IDs. API clients must not provide or set `isSystemRole`; API-created roles must not become system roles.
- FR-6: Role list and detail responses must include a frontend-ready role shape: role ID, name, description, campus ID, system/default/read-only flags, assigned permissions, member counts when requested or documented, timestamps, and stable metadata needed to disable forbidden UI actions.
- FR-7: Permission catalog endpoints must return all assignable permissions grouped or groupable by module, with stable IDs and descriptions. The response must distinguish permissions that are available for assignment from permissions only visible for audit, if such a distinction exists.
- FR-8: Role permission mutation must support incremental add/remove operations and an atomic replace-all operation. Replace-all must leave the role with exactly the supplied final permission set or fail with no partial change.
- FR-9: Membership APIs must expose assignment provenance for each role member, including at minimum user ID, profile display fields available to the backend, campus ID, role ID, source/provenance type, StaffType provenance when present, assigned timestamp, and whether direct revoke will remove derived grants.
- FR-10: Role grant/revoke endpoints must be idempotent from a client perspective: repeated grant does not duplicate membership, and repeated revoke of a missing assignment does not create false audit state.
- FR-11: Mutations must emit audit events for role create, role update, role delete, role permission add/remove/replace, role membership grant, and role membership revoke. Audit context must include actor, role ID, campus ID where applicable, changed permission IDs where applicable, affected user IDs where applicable, and enough before/after information for investigation.
- FR-12: The API must preserve existing RBAC semantics: permission checks use permission IDs, applicable roles include global and campus-specific assignments, system-role global admin bypass remains seed/CLI-owned, and permissions resolve through `RolePermission` joins only.
- FR-13: Swagger/OpenAPI documentation must describe authentication, campus scoping, required permissions, request bodies, response shapes, read-only flags, audit semantics, and error responses for the RBAC admin surface.
- FR-14: Controller/e2e or equivalent integration coverage must verify that unauthorized, wrong-campus, missing-permission, and read-only-system-role scenarios are rejected before any mutation occurs.

### Non-Functional Requirements

- NFR-1: Security is the primary readiness gate. No authenticated user may list, mutate, grant, revoke, or inspect RBAC data beyond their authorized campus/global scope.
- NFR-2: RBAC mutations must be transactional where multiple rows or audit records are affected. No partial permission replacement, partial membership batch, or orphan audit record may be committed.
- NFR-3: Responses must be stable enough for frontend implementation: no route should return empty permission arrays due to missing includes when the documented shape promises assigned permissions.
- NFR-4: The implementation must remain compatible with the existing multi-campus architecture and standard pagination/filtering conventions.
- NFR-5: Existing feature guards using `@Permissions(...)` must continue to work after the management API changes.

## Acceptance Criteria

- [ ] AC-1: `GET /api/roles` or the documented campus role list route requires authentication, `role.list`, and campus access, and returns only roles applicable to the requested campus plus visible read-only system roles when documented.
- [ ] AC-2: The campus role list response includes assigned permissions for every returned role when the documented response shape says it does; it does not serialize all roles with `permissions: []` due to missing repository includes.
- [ ] AC-3: `GET /api/roles/:id` or the documented role detail route requires `role.read`, enforces scope, and returns permissions, read-only flags, and system-role metadata.
- [ ] AC-4: Creating a campus role succeeds with a database-valid UUID-backed role ID, rejects `isSystemRole`, rejects client attempts to create system/global bypass roles, validates campus ownership, and returns the created role with assigned permissions.
- [ ] AC-5: Updating or deleting a normal campus role requires `role.update` or `role.delete`, validates campus ownership, and emits audit events.
- [ ] AC-6: Updating, deleting, granting membership to, revoking membership from, or mutating permissions on a system role or system-default role returns a 4xx error and performs no write.
- [ ] AC-7: Assigning role permissions incrementally requires `role.update`, validates every permission ID, is idempotent for already-assigned permissions, and emits an audit event listing added permissions.
- [ ] AC-8: Removing role permissions incrementally requires `role.update`, is idempotent for missing permissions, and emits an audit event listing removed permissions only when state changes.
- [ ] AC-9: Replacing all role permissions requires `role.update`, validates every permission ID, applies atomically, emits one audit event with before/after permission IDs, and leaves no partial state on failure.
- [ ] AC-10: Role member list requires `role.read` or `role.assign` as documented, enforces campus scope, supports pagination/filtering consistent with project conventions, and returns provenance metadata for each assignment.
- [ ] AC-11: Granting users to a campus role requires `role.assign`, validates the role belongs to the target campus, rejects system roles, writes membership and audit rows atomically, and suppresses duplicate grants.
- [ ] AC-12: Revoking users from a campus role requires `role.assign`, validates the role belongs to the target campus, rejects system roles, may remove manual and StaffType-derived rows for the selected tuple per D5, and emits audit only for actual state changes.
- [ ] AC-13: Explicit global/audit read endpoints require appropriate global `role.list` or `role.read` authorization and do not allow mutation.
- [ ] AC-14: Missing authentication returns 401; missing required permission returns 403; missing or invalid campus context returns the existing campus guard error semantics; cross-campus access is rejected.
- [ ] AC-15: Tests cover at least one unauthorized case for every mutation category: role CRUD, permission mutation, and membership mutation.
- [ ] AC-16: Build and the relevant RBAC/role-management test suite pass.

## Scenarios

### Scenario 1: Campus Admin Lists Roles
**Given** an authenticated user has campus access and `role.list` in campus A
**When** the frontend requests the campus role list for campus A
**Then** the API returns campus A roles with assigned permissions and read-only metadata, and does not return mutable roles from campus B.

### Scenario 2: User Without Role Permission Is Blocked
**Given** an authenticated user has campus access but lacks `role.list`
**When** the user requests the campus role list
**Then** the API returns 403 and does not reveal role data.

### Scenario 3: Create Campus Role
**Given** an authenticated user has `role.create` for campus A
**When** the frontend creates a role with name, description, and initial permission IDs
**Then** the API creates a non-system campus-scoped role with a valid database ID, assigns valid permissions, returns the role detail shape, and emits a role-created audit event.

### Scenario 4: System Role Is Visible But Read-Only
**Given** Super Admin exists as a system role
**When** an authorized admin views role details or global audit views
**Then** the role is visible with read-only/system metadata
**And** attempts to mutate it through normal APIs fail with no writes.

### Scenario 5: Replace Role Permissions Atomically
**Given** a campus role currently has permissions A and B
**When** an authorized admin saves final permissions B and C
**Then** the role ends with exactly B and C, an audit event records before A/B and after B/C, and any invalid permission ID causes the whole operation to fail unchanged.

### Scenario 6: Membership Provenance and Override
**Given** a user has a role through a StaffType-derived grant
**When** an authorized admin views role members
**Then** the response identifies the assignment provenance
**And** when the admin revokes that role-user-campus tuple, the API removes the selected grant rows per D5 and audits the actual state change.

### Scenario 7: Global Audit View
**Given** an authorized global auditor has the required global role read/list permission
**When** the auditor requests the explicit global RBAC audit endpoint
**Then** the API returns system-wide role and assignment visibility without enabling mutation through that endpoint.

## Technical Notes

- Existing implementation entry points include `src/infra/http/controllers/user-management/role.controller.ts`, `src/application/rbac/use-cases/*`, `src/application/user-management/use-cases/role/*`, `src/infra/persistence/prisma/repositories/prisma-role.repository.ts`, and `src/infra/http/guards/permissions.guard.ts`.
- Existing role routes may be retained if they are secured and reshaped, or a clearer `/api/rbac/admin/...` route group may be introduced. The final OpenAPI contract must be explicit before frontend implementation starts.
- The existing `Role.id @db.Uuid` schema means role creation must not use slug IDs unless the schema is intentionally changed by a separate, reviewed migration.
- Permission IDs remain stable `module.action` strings. Role IDs are not permission IDs.
- Use existing `StandardRequestDto` pagination/filtering conventions where listing is needed.
- Existing grant/revoke use cases already provide useful atomicity and audit behavior for direct membership changes; this spec extends equivalent audit coverage to role and permission mutations.

## Task Links

- @task-elaxso [rbac-admin-management-api-hardening-01] Add secured RBAC admin read surface - todo
- @task-v1d4ou [rbac-admin-management-api-hardening-02] Harden role CRUD mutations - todo
- @task-ovs0ub [rbac-admin-management-api-hardening-03] Add audited role permission mutations - todo
- @task-swf7uf [rbac-admin-management-api-hardening-04] Add role membership management with provenance - todo
- @task-3bmubi [rbac-admin-management-api-hardening-05] Add RBAC admin authorization coverage and final verification - todo

## Open Questions

None. Decisions D1-D6 are locked for this draft.
