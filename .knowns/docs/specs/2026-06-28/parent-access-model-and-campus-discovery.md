---
title: Parent Access Model And Campus Discovery
description: Specification for parent relationship-based campus discovery and reusable parent access authorization semantics.
createdAt: '2026-06-28T23:47:52.693Z'
updatedAt: '2026-07-10T22:05:02.177Z'
tags:
  - spec
  - approved
  - parent-access
  - rbac
  - guardian
  - campus
---

# Parent Access Model And Campus Discovery

## Overview

Define a reusable parent access model and add a parent-specific campus discovery endpoint. Parent-facing/self-service access must be based on the authenticated user's active Guardian profile and guardian-student relationships, not on RBAC campus role membership. Staff and admin access remains governed by the existing RBAC campus access and permissions pipeline.

This spec closes the current bootstrap gap found after Parent Request Center absence requests: parent self-service routes can authorize relationship-only parents once a campus is selected, but `GET /campuses` is still role-assignment based and may return no campuses for parents who have no campus role assignments.

Related context:
- @doc/architecture/rbac-system
- @doc/patterns/guards-pattern
- @doc/specs/2026-06-26/parent-request-center-absence-requests-backend
- @doc/archive/research/parent-request-center-absence-requests-backend-research

## Locked Decisions

- D1: Parent campus discovery uses a new endpoint, `GET /guardians/me/campuses`, separate from `/auth/me` and `GET /campuses`.
- D2: The change covers both campus discovery and a reusable parent access pattern for future parent/self-service endpoints.
- D3: `GET /guardians/me/campuses` returns only campuses where the authenticated user has an active Guardian profile. It does not include role-based staff/admin campus access.

## Requirements

### Functional Requirements

- FR-1: Add `GET /guardians/me/campuses` for authenticated users to discover campuses where they have an active Guardian profile.
- FR-2: The endpoint must derive identity from the authenticated domain `User`; it must not accept `userId`, `guardianId`, or role-assignment filters from the client.
- FR-3: The endpoint must return only active, non-archived Guardian profiles and their non-archived campuses.
- FR-4: The endpoint must return guardian-campus records only; staff/admin role-based campus access must remain represented by existing RBAC surfaces such as `GET /campuses`.
- FR-5: If the authenticated user has no active Guardian profiles, the endpoint must return an empty list rather than treating the user as unauthorized.
- FR-6: If the request is unauthenticated or the authenticated identity cannot be resolved to a domain `User`, the endpoint must use existing authentication error behavior.
- FR-7: Define and document the reusable parent access pattern: validate campus context, hydrate the current user, resolve an active Guardian by `currentUser.id + campusId`, and authorize resource access through the relevant relationship such as `GuardianStudent`.
- FR-8: Existing Parent Request Center absence request flows must remain compatible with the parent access pattern and must not be changed to require seeded parent campus roles.
- FR-9: Existing staff/admin endpoints must continue to use default `@RequireCampusAccess()` plus role/permission checks where applicable; parent relationship access must not broaden admin/staff campus access.
- FR-10: Parent/self-service routes must not trust client-provided `guardianId` for authorization decisions.

### Non-Functional Requirements

- NFR-1: Security: relationship-only parent access must be scoped to active Guardian profiles and explicit resource relationships; it must not grant general campus administration or RBAC permissions.
- NFR-2: Privacy: the campus discovery endpoint must not disclose campuses where the user has no active Guardian profile.
- NFR-3: Backward compatibility: `GET /campuses`, `/auth/me`, and existing staff/admin RBAC semantics must remain unchanged unless a future spec explicitly changes them.
- NFR-4: Consistency: new parent/self-service endpoints should reuse the same parent access pattern instead of duplicating ad hoc guardian resolution logic.
- NFR-5: Testability: endpoint behavior and guard/decorator composition must be covered by focused tests.

## Acceptance Criteria

- [ ] AC-1: `GET /guardians/me/campuses` returns all and only non-archived campuses where the authenticated user has a non-archived Guardian profile.
- [ ] AC-2: A user with staff/admin role access but no Guardian profile receives an empty array from `GET /guardians/me/campuses`.
- [ ] AC-3: A user with both staff/admin roles and Guardian profiles receives only Guardian-profile campuses from `GET /guardians/me/campuses`.
- [ ] AC-4: A user with archived Guardian profiles, archived campuses, or no active Guardian profiles does not receive those campuses in the response.
- [ ] AC-5: Unauthenticated requests to `GET /guardians/me/campuses` fail through the existing Clerk/domain-user authentication path.
- [ ] AC-6: The endpoint never accepts or uses client-provided `userId` or `guardianId` to choose campuses.
- [ ] AC-7: Parent access guidance is documented in the relevant guard/decorator or architecture docs, including when to use `@RequireCampusAccess({ checkUserAccess: false })` plus current-user hydration and relationship authorization.
- [ ] AC-8: Existing parent absence request routes continue to bypass RBAC campus role membership while enforcing current-user guardian resolution and linked-student checks.
- [ ] AC-9: Existing admin/staff absence request routes and guardian administration routes continue to require normal campus access and permissions where already configured.
- [ ] AC-10: Tests cover campus discovery, mixed staff+guardian users, archived records, unauthenticated requests, and no client-provided guardian trust.

## Scenarios

### Scenario 1: Parent Discovers Guardian Campuses

**Given** an authenticated user has active Guardian profiles in Campus A and Campus B
**When** the user calls `GET /guardians/me/campuses`
**Then** the response contains Campus A and Campus B with parent-discovery metadata
**And** no client-provided guardian identifier is required.

### Scenario 2: Staff User Without Guardian Profile

**Given** an authenticated user has RBAC staff/admin access to Campus A
**And** the user has no active Guardian profile
**When** the user calls `GET /guardians/me/campuses`
**Then** the response is an empty list.

### Scenario 3: Mixed Staff And Parent User

**Given** an authenticated user has staff/admin role access to Campus A
**And** an active Guardian profile in Campus B
**When** the user calls `GET /guardians/me/campuses`
**Then** the response includes Campus B
**And** the response does not include Campus A unless the user also has an active Guardian profile there.

### Scenario 4: Archived Guardian Or Campus Is Hidden

**Given** an authenticated user has a Guardian profile for Campus A
**And** either the Guardian profile or Campus A is archived
**When** the user calls `GET /guardians/me/campuses`
**Then** Campus A is not returned.

### Scenario 5: Future Parent Endpoint Uses Relationship Authorization

**Given** an authenticated user selects Campus A
**And** the user has an active Guardian profile in Campus A linked to Student S
**When** the user calls a parent/self-service endpoint for Student S
**Then** the endpoint validates campus context, resolves the current Guardian from `currentUser.id + campusId`, and authorizes access through the student relationship.

### Scenario 6: Parent Attempts Cross-Student Access

**Given** an authenticated user has an active Guardian profile in Campus A
**And** Student S is not linked to that Guardian in Campus A
**When** the user calls a parent/self-service endpoint for Student S
**Then** the request is rejected with the existing parent-domain forbidden behavior.

## Technical Notes

- Current default campus access is role-based: `CampusGuard` uses `hasCampusAccess(user, campusId)`, which checks `user.getRolesForCampus(campusId)`.
- Existing parent absence routes already use the intended parent pattern: `@RequireCampusAccess({ checkUserAccess: false })`, `HydrateCurrentUserGuard`, campus-aware Guardian resolution, and `GuardianStudent` relationship checks.
- The new endpoint should likely live on `GuardianController` near `GET /guardians/me/students`, but implementation details belong in task planning.
- The response should expose enough campus summary fields for frontend campus selection while avoiding unrelated guardian/student details unless needed by the client.
- This spec intentionally does not change `GET /campuses`; that endpoint remains role-assignment based.

## Task Links

- @task-oswknw [parent-access-model-and-campus-discovery-01] Add guardian campus discovery endpoint - todo
- @task-650jlr [parent-access-model-and-campus-discovery-02] Document reusable parent access pattern - todo
- @task-uysc36 [parent-access-model-and-campus-discovery-03] Add parent access regression coverage - todo

## Open Questions

- [ ] Confirm final response shape for `GET /guardians/me/campuses` during task planning, based on existing campus DTO conventions and frontend needs.
