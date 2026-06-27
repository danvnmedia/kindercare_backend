---
title: Staff Type RBAC Hardening
description: Specification for hardening StaffType management with RBAC permissions, campus scoping, audit events, and safe default-role validation.
createdAt: '2026-06-27T17:31:09.411Z'
updatedAt: '2026-06-27T18:06:38.260Z'
tags:
  - spec
  - approved
  - rbac
  - staff-type
  - security
  - api
---

## Overview

Harden the StaffType management API so StaffType configuration is governed by the same RBAC and campus-safety expectations as role management. StaffType remains a staff-domain classification, but because it can imply default roles through `defaultRoleId`, its administration must be permission-gated, campus-scoped, audited, and protected from unsafe role mappings.

Related context:
- @doc/architecture/rbac-system
- @doc/patterns/guards-pattern
- @doc/specs/2026-06-26/rbac-admin-management-api-hardening

## Locked Decisions

- D1: All StaffType endpoints must enforce matching RBAC permissions: `staff_type.list`, `staff_type.read`, `staff_type.create`, `staff_type.update`, and `staff_type.delete`. Read/list endpoints are permission-gated, not just mutations.
- D2: Every StaffType route must require campus context, including ID-based `GET`, `PATCH`, and `DELETE`; the API must reject cross-campus StaffType access even when the caller knows the UUID.
- D3: `POST /staff-types/reorder` is protected by `staff_type.update`, because it mutates existing StaffType ordering rather than creating or deleting staff types.
- D4: StaffType mutation routes must emit audit events as part of this hardening: create, update, archive/delete, and reorder. Read/list routes do not emit audit events.
- D5: StaffType mutation audit events use explicit action names: `CREATE_STAFF_TYPE`, `UPDATE_STAFF_TYPE`, `ARCHIVE_STAFF_TYPE`, and `REORDER_STAFF_TYPES`.
- D6: Audit payloads should include before/after values for changed fields where meaningful. `CREATE_STAFF_TYPE` and `ARCHIVE_STAFF_TYPE` must include enough context to identify the StaffType; `UPDATE_STAFF_TYPE` and `REORDER_STAFF_TYPES` should capture meaningful before/after state.
- D7: When a StaffType sets `defaultRoleId`, the role must be valid for that campus and must not be a system/global-admin role. A missing, cross-campus, or system role must be rejected.

## Requirements

### Functional Requirements

- FR-1: StaffType controller routes require authenticated access, campus access, and the appropriate `PermissionsGuard` permission before executing the use case.
- FR-2: Permission mapping is exact:
  - `POST /staff-types` requires `staff_type.create`.
  - `GET /staff-types` requires `staff_type.list`.
  - `GET /staff-types/:id` requires `staff_type.read`.
  - `PATCH /staff-types/:id` requires `staff_type.update`.
  - `DELETE /staff-types/:id` requires `staff_type.delete`.
  - `POST /staff-types/reorder` requires `staff_type.update`.
- FR-3: All StaffType routes require campus context via the standard campus access path. ID-based routes must validate that the target StaffType belongs to the current campus before returning or mutating it.
- FR-4: Cross-campus StaffType access is rejected for read, update, archive/delete, and reorder operations, even when the caller has the required permission in another campus.
- FR-5: `defaultRoleId` validation on StaffType create/update rejects missing roles, roles owned by another campus, and system/global-admin roles.
- FR-6: StaffType create emits a `CREATE_STAFF_TYPE` audit event after a successful state change.
- FR-7: StaffType update emits an `UPDATE_STAFF_TYPE` audit event after a successful state change, including before/after values for changed fields such as name, description, defaultRoleId, isArchived, and order.
- FR-8: StaffType archive/delete emits an `ARCHIVE_STAFF_TYPE` audit event after a successful state change, including enough context to identify the archived StaffType.
- FR-9: StaffType reorder emits a `REORDER_STAFF_TYPES` audit event after a successful state change, including meaningful before/after ordering state.
- FR-10: Read/list StaffType routes do not emit audit events.
- FR-11: Existing response contracts for StaffType management remain compatible unless an authorization, campus-scope, or validation error is required by this spec.

### Non-Functional Requirements

- NFR-1: Permission failures must fail closed before StaffType data is returned or mutated.
- NFR-2: Campus-scope failures must not leak cross-campus StaffType details beyond the existing error-response conventions used by the project.
- NFR-3: Audit writes for mutation routes must be committed atomically with the StaffType mutation wherever the existing Unit of Work pattern supports it.
- NFR-4: The implementation must follow existing NestJS guard/decorator patterns and Clean Architecture boundaries used by the RBAC role management APIs.

## Acceptance Criteria

- [ ] AC-1: Each StaffType route is covered by tests proving a caller without the required `staff_type.*` permission is rejected.
- [ ] AC-2: Each StaffType route is covered by tests proving a caller with the required permission and valid campus access can reach the intended use case.
- [ ] AC-3: `GET /staff-types/:id`, `PATCH /staff-types/:id`, and `DELETE /staff-types/:id` reject a StaffType from a different campus.
- [ ] AC-4: `POST /staff-types/reorder` rejects IDs outside the active campus and requires `staff_type.update`.
- [ ] AC-5: StaffType create/update rejects `defaultRoleId` values that are missing, cross-campus, or system/global-admin roles.
- [ ] AC-6: Successful create/update/archive/reorder operations emit audit events with the action names locked in D5.
- [ ] AC-7: Update and reorder audit events include before/after state sufficient to identify the fields or order values changed.
- [ ] AC-8: Read/list operations remain unaudited and do not write audit rows.
- [ ] AC-9: Existing StaffType API DTO shape remains stable for successful responses.
- [ ] AC-10: Verification includes focused controller authorization tests and use-case or repository tests for campus ownership, default-role validation, and audit behavior.

## Scenarios

### Scenario 1: Authorized Campus Admin Lists Staff Types
**Given** a user has campus access and `staff_type.list` in the current campus
**When** the user calls `GET /staff-types` with the campus header
**Then** the API returns the paginated StaffType list for that campus
**And** no audit event is written.

### Scenario 2: Missing Permission Is Blocked
**Given** a user has campus access but lacks `staff_type.update`
**When** the user calls `PATCH /staff-types/:id`
**Then** the request is rejected before mutation
**And** no StaffType update or audit event occurs.

### Scenario 3: Cross-Campus StaffType Read Is Blocked
**Given** a user has `staff_type.read` for campus A
**And** a StaffType ID belongs to campus B
**When** the user calls `GET /staff-types/:id` under campus A context
**Then** the API rejects the request and does not return the campus B StaffType.

### Scenario 4: Create StaffType With Safe Default Role
**Given** a user has `staff_type.create` in the current campus
**And** the supplied `defaultRoleId` belongs to the same campus and is not a system/global-admin role
**When** the user creates a StaffType
**Then** the StaffType is created
**And** a `CREATE_STAFF_TYPE` audit event identifies the created StaffType and relevant context.

### Scenario 5: Create StaffType With Unsafe Default Role
**Given** a user has `staff_type.create` in the current campus
**When** the user supplies a missing, cross-campus, or system/global-admin `defaultRoleId`
**Then** the request is rejected
**And** no StaffType or audit event is created.

### Scenario 6: Reorder Staff Types
**Given** a user has `staff_type.update` in the current campus
**When** the user calls `POST /staff-types/reorder` with only StaffType IDs from that campus
**Then** the order is updated
**And** a `REORDER_STAFF_TYPES` audit event records meaningful before/after ordering state.

### Scenario 7: Archive Staff Type
**Given** a user has `staff_type.delete` in the current campus
**When** the user calls `DELETE /staff-types/:id` for a StaffType in that campus
**Then** the StaffType is archived according to existing delete behavior
**And** an `ARCHIVE_STAFF_TYPE` audit event identifies the archived StaffType.

## Technical Notes

- Follow the existing RBAC role-management controller pattern: `@RequireCampusAccess()`, `@UseGuards(PermissionsGuard)`, and `@Permissions(...)` on protected routes.
- Preserve StaffType as a staff-domain concept. Do not replace StaffType with Role in this spec.
- ID-based StaffType use cases may need campus-aware input or explicit campus ownership checks to enforce D2.
- `defaultRoleId` validation should use role metadata sufficient to distinguish same-campus roles from cross-campus roles and system/global-admin roles; plain existence checks are not enough.
- Audit behavior should follow the existing Unit of Work and audit context conventions where applicable.
- `DELETE /staff-types/:id` currently represents archive/soft-delete behavior; this spec keeps that behavior and hardens authorization/audit semantics around it.

## Task Links

- @task-agk0jx [staff-type-rbac-hardening-01] Secure StaffType controller with RBAC permissions - todo
- @task-11jri4 [staff-type-rbac-hardening-02] Enforce StaffType campus ownership and safe default roles - todo
- @task-dv5i50 [staff-type-rbac-hardening-03] Add StaffType mutation audit events - todo
- @task-kbp81e [staff-type-rbac-hardening-04] Add final coverage and verification - todo

## Open Questions

- [ ] None.
