---
title: Health Unified Flow Backend
description: Backend specification for a permission-aware unified Health Center daily read model with medication work and authoritative action counts.
createdAt: '2026-07-15T00:54:52.405Z'
updatedAt: '2026-07-15T01:29:31.802Z'
tags:
  - spec
  - approved
  - backend
  - health-center
  - student-health
  - medication
  - api
---

# Health Unified Flow Backend

## Overview

Extend the existing Health Center daily read model so the frontend can render one permission-aware operational overview containing active student health instructions, unresolved health events, due/overdue medication administrations, and authoritative action counts for the active campus and campus-local date.

This is a read-model and authorization-composition change. Existing student-health, medication-request, and medication-administration entities and write endpoints remain separate and authoritative. No new cross-domain persistence model is introduced.

This specification extends `specs/2026-07-14/student-health-and-medication-lifecycle-backend` and its handoff at `backend-handoff/student-health-and-medication-lifecycle-backend-handoff`. The coordinated frontend behavior is specified in the frontend repository at `specs/2026-07-14/health-unified-flow-frontend`.

## Goals

- Provide one campus-local read contract for the Health Center Today view.
- Return only sections/counts allowed by the caller’s effective campus permissions.
- Provide authoritative totals suitable for triage and a lightweight sidebar badge request.
- Reuse canonical medication administration representations and lifecycle rules.
- Preserve existing daily-items consumers during the frontend/backend transition.

## Non-Goals

- Creating a unified health/medication database entity or table.
- Changing health record, medication request, or administration write commands.
- Adding checkup reminders, profile compliance, notifications, or background jobs.
- Adding role-name restrictions such as nurse-only access.
- Returning complete medication-request rows from the daily endpoint.
- Removing the existing medication summary endpoint in this change.
- Changing medication lifecycle reconciliation, occurrence materialization, correction, or audit behavior.

## Locked Decisions

- D1: Health Center is the unified staff operational hub; backend domains remain separate.
- D2: Today includes due/overdue medication administrations, active care instructions, and unresolved health events.
- D3: Request review and medication administration remain distinct lifecycle stages and canonical APIs.
- D4: Access and returned sections are based on effective campus permissions, not staff role names.
- D5: The existing `GET /api/health-center/daily-items` evolves into the purpose-built, cross-domain daily read model.
- D6: The response provides authoritative, permission-filtered counts; the frontend does not assemble cross-domain totals.
- D7: A count-only mode supports the navigation badge without hydrating daily item rows.
- D8: Navigation action count includes actionable SUBMITTED requests and due/overdue unrecorded medication occurrences only.
- D9: Health Profile and Checkups are excluded because no due/compliance rules exist.
- D10: Writes remain server-confirmed through existing endpoints; the read model is side-effect free.
- D11: Date defaults and comparisons use the campus IANA timezone; an explicit `YYYY-MM-DD` is accepted.
- D12: Existing instruction/event response fields remain compatible during the transition.

## Requirements

### Functional Requirements

#### Endpoint and Query Contract

- FR-1: Extend `GET /api/health-center/daily-items`; do not create a parallel endpoint that requires the frontend to choose between a health-only and unified Today contract.
- FR-2: Preserve existing query fields and validation: `date?`, `classId?`, `instructionsOffset?`, `instructionsLimit?`, `eventsOffset?`, and `eventsLimit?`.
- FR-3: Add `medicationsOffset?` and `medicationsLimit?` with the same defaults and bounds as the existing independent groups: offset default 0; limit default 50, minimum 1, maximum 100.
- FR-4: Add `summaryOnly?` as a strict boolean query value. Omitted/false returns permitted item arrays; true returns counts/access metadata without hydrating item rows.
- FR-5: Resolve omitted `date` to the selected campus’s local current `YYYY-MM-DD` using its persisted IANA timezone and one captured `now` per request.
- FR-6: Validate `classId` belongs to the selected campus before any domain item query. A foreign/missing class returns 404 and no section data.
- FR-7: Apply `classId`, when present, consistently to instructions, events, medication administrations, and request-review counts. The selected Health Center `date` determines effective class enrollment for all class-scoped rows and counts. It must not filter medication requests by their `startDate` or `endDate`; effective request expiration instead uses actual campus-local today under FR-23.

#### Permission-Aware Authorization

- FR-8: Permit endpoint entry when the caller has campus access and at least one of `student_health.read`, `medication_administration.read`, or `medication_request.list`, or is global Super Admin.
- FR-9: Derive effective permission IDs from the authenticated domain user for the selected campus using the canonical RBAC permission-access helpers. Do not accept permission claims from query/body input.
- FR-10: Query and return instruction/event data only with `student_health.read`.
- FR-11: Query and return medication occurrence data only with `medication_administration.read`.
- FR-12: Query request Needs Review counts only with `medication_request.list`; count them as actionable only when the user also has `medication_request.read` and `medication_request.update`.
- FR-13: Count due/overdue medication occurrences as actionable only when the user has both `medication_administration.read` and `medication_administration.create`. `medication_administration.update` alone authorizes corrections, not first records.
- FR-14: An unauthorized section must have `access` false, zero counts, empty arrays, and zero pagination totals, and its repository/use case must not be invoked.
- FR-15: Global Super Admin receives all sections and action counts while normal campus scoping remains enforced. Implement the bypass centrally in `PermissionsGuard` through `user.hasSystemRole()`: a globally assigned system role bypasses permission checks, while a campus-scoped system role and a globally assigned non-system role do not. Ordinary permission checks and OR semantics remain unchanged.

#### Response Contract

- FR-16: Preserve the current top-level `campusId`, normalized `date`, `classId`, `instructions`, `events`, and independent instruction/event pagination shapes.
- FR-17: Add a server `generatedAt` timestamp and explicit access metadata:
  - `healthItems`: caller may receive instructions/events;
  - `medicationAdministrations`: caller may receive administration rows;
  - `medicationRequests`: caller may receive request Needs Review counts;
  - `canRecordMedication`: due/overdue occurrences contribute to action count;
  - `canReviewMedicationRequests`: SUBMITTED requests contribute to action count.
- FR-18: Add `medicationAdministrations` using the canonical daily administration queue DTO shape, including occurrence/request IDs, student/class summary, medication name/dosage/instructions, due date/time, computed status, parent notes, and nullable latest log/outcome fields. The student summary remains required and non-null; guardian is not part of this response. Class, avatar, dosage, notes, actor summaries, latest log, and latest outcome retain their existing nullable contracts.
- FR-19: Add independent `pagination.medicationAdministrations` with offset, limit, total, and hasMore.
- FR-20: Preserve existing `counts.instructions`, `counts.events`, and legacy health-only `counts.total` semantics for compatibility.
- FR-21: Add counts for `medicationAdministrations`, `dueMedicationAdministrations`, `overdueMedicationAdministrations`, `requestsNeedingReview`, `visibleTotal`, and `actionRequired`.
- FR-22: `visibleTotal` equals all records visible to the caller in the three Today item sections. `actionRequired` equals only caller-actionable due + overdue unrecorded medication occurrences plus actionable SUBMITTED medication requests.
- FR-23: `requestsNeedingReview` counts only effectively actionable persisted requests satisfying `status = SUBMITTED AND endDate >= actual campus-local today`. `NEEDS_MORE_INFO` is excluded because the next action belongs to the caregiver. Actual campus-local today is derived from the request-captured `now`, not the selected Health Center inspection date.
- FR-24: `summaryOnly=true` returns the same access and count semantics, `generatedAt`, campus/date/class context, zero-length item arrays, and valid pagination totals without full row hydration. Each pagination group echoes the normalized requested offset/limit and complete filtered total; summary-only `hasMore` is `offset + limit < total`.

An illustrative additive response data shape is:

```ts
type HealthCenterDailyItems = {
  campusId: string;
  date: string;
  classId: string | null;
  generatedAt: string;
  access: {
    healthItems: boolean;
    medicationAdministrations: boolean;
    medicationRequests: boolean;
    canRecordMedication: boolean;
    canReviewMedicationRequests: boolean;
  };
  counts: {
    instructions: number;
    events: number;
    total: number; // legacy health-only total
    medicationAdministrations: number;
    dueMedicationAdministrations: number;
    overdueMedicationAdministrations: number;
    requestsNeedingReview: number;
    visibleTotal: number;
    actionRequired: number;
  };
  pagination: {
    instructions: PaginationGroup;
    events: PaginationGroup;
    medicationAdministrations: PaginationGroup;
  };
  instructions: HealthCenterInstructionItem[];
  events: HealthCenterEventItem[];
  medicationAdministrations: MedicationAdministrationQueueItem[];
};
```

#### Daily Item Semantics

- FR-25: Instructions remain non-archived, active for the reference date, campus-scoped, and class-scoped using effective enrollment behavior already implemented.
- FR-26: Events remain non-archived OPEN events that occurred on or before the reference date, campus-scoped and class-scoped using existing operational behavior.
- FR-27: Medication rows come from materialized occurrences for the reference date and reuse the canonical daily queue status calculation. Do not reconstruct occurrence schedules in the Health Center use case.
- FR-28: The medication Today item array includes due and overdue, unrecorded occurrences only; recorded outcomes remain available from the canonical Medication view endpoint and do not clutter Today.
- FR-29: `dueMedicationAdministrations` and `overdueMedicationAdministrations` are mutually exclusive server-derived counts for those returned operational statuses.
- FR-30: Completed medication requests do not suppress still-actionable occurrences. Request lifecycle state must not be used as a proxy for occurrence outcome.
- FR-31: Archived health records are always excluded. Checkups and Health Profile data are never queried by this endpoint.

#### Count and Pagination Correctness

- FR-32: Counts must represent complete filtered totals, not the size of paginated arrays.
- FR-33: Independent offsets/limits must not change any count or sibling section pagination.
- FR-34: Summary-only execution should use count/projection repository methods and must not load full item graphs merely to discard them.
- FR-35: Capture one `now` and use it consistently for `generatedAt`, omitted-date resolution, event visibility cutoffs, medication status/counts, and the actual campus-local today used for effective SUBMITTED-request expiration. An explicit selected inspection date remains the response/reference date and does not replace actual campus-local today for request expiration.
- FR-36: Action counts must never reveal records from unauthorized domains, another campus, or a class outside the filter.

#### Compatibility and Existing APIs

- FR-37: Existing consumers that read only instructions, events, their pagination, and legacy `counts.total` must continue to deserialize and behave correctly.
- FR-38: Keep `GET /api/health-center/medication-summary` operational and response-compatible during this change, mark it deprecated in Swagger/handoff, and do not make the new frontend depend on it.
- FR-39: Keep the following canonical APIs unchanged:
  - `GET /api/medication-administrations/daily`;
  - `POST /api/medication-administrations/:occurrenceId/record`;
  - staff medication request list/detail/review routes;
  - student health profile/checkup/instruction/event routes.
- FR-40: The daily read endpoint remains side-effect free: it creates no audit record, lifecycle transition, occurrence, or administration log.

#### Error Behavior

- FR-41: Invalid date, strict boolean, UUID, offset, or limit values return the existing standard 400 error envelope.
- FR-42: Missing/foreign class returns 404; missing campus access or no qualifying entry permission returns 403.
- FR-43: A failure in an authorized domain query fails the unified request through the standard error envelope; do not return silently incomplete data marked as authorized.
- FR-44: The canonical medication queue student summary is required and non-null, and guardian is not part of this response. Nullable/deleted class, avatar, dosage, notes, actor summaries, latest log, and latest outcome remain valid response states and use their established nullable DTO fields rather than causing server errors.

### Non-Functional Requirements

- NFR-1: Maintain clean application/use-case, port, Prisma repository, controller, and DTO boundaries. The Health Center use case may orchestrate domain repositories but must not import Prisma directly.
- NFR-2: Execute independent authorized section/count queries concurrently after campus/class/permission validation.
- NFR-3: `summaryOnly=true` must avoid full item hydration and be suitable for periodic sidebar refresh without material database amplification.
- NFR-4: Add no schema migration unless implementation proves a missing index is required. Any new index must be justified by query plans and added through Prisma migration.
- NFR-5: Swagger must document query defaults/bounds, partial-permission behavior, response access metadata, new counts, and medication item schema.
- NFR-6: Preserve standard success/error envelopes and `x-campus-id` scoping.
- NFR-7: Tests must cover permission matrices, Super Admin, campus/class isolation, timezone boundaries, summary-only behavior, count semantics, pagination independence, compatibility fields, archived exclusion, completed-request occurrences, and repository non-invocation for unauthorized sections.

## Acceptance Criteria

- [ ] AC-1: A health-only user receives instruction/event data and zero/unauthorized medication sections without medication repository calls.
- [ ] AC-2: An administration-only user receives medication Today items and zero/unauthorized health/request sections without health/request repository calls.
- [ ] AC-3: A request-review-only user can retrieve permission-filtered Needs Review/action counts without receiving health or administration rows.
- [ ] AC-4: A fully authorized user receives all permitted sections, pagination, counts, access metadata, and one consistent campus-local date.
- [ ] AC-5: A user with administration read but no create sees medication data but due/overdue items do not contribute to `actionRequired`.
- [ ] AC-6: A user with request list but without read/update sees request visibility count as permitted but no request contribution to `actionRequired`.
- [ ] AC-7: `summaryOnly=true` returns authoritative complete totals, normalized requested offset/limit values, `hasMore = offset + limit < total`, and empty arrays without executing full-row hydration queries.
- [ ] AC-8: Class filtering applies consistently across all returned sections/counts, uses the selected Health Center date only for effective enrollment, does not date-filter requests by request start/end dates, and rejects a foreign-campus class before data access.
- [ ] AC-9: `counts.total` remains health-only for compatibility while `visibleTotal` and `actionRequired` follow their new documented formulas.
- [ ] AC-10: Needs Review counts include only `SUBMITTED` requests whose `endDate` is on or after actual campus-local today, and exclude `NEEDS_MORE_INFO`, effectively expired SUBMITTED requests, and all other states.
- [ ] AC-11: Today medication rows/counts include only due/overdue unrecorded occurrences and do not suppress occurrences because their request is COMPLETED.
- [ ] AC-12: Existing daily-items instruction/event consumers and the existing medication-summary endpoint remain contract-compatible.
- [ ] AC-13: The unified read performs no lifecycle writes, logs, audit writes, or occurrence materialization.
- [ ] AC-14: Unit/controller/repository/integration tests verify all requirements and Knowns validation passes.
- [ ] AC-15: `PermissionsGuard` centrally bypasses permission checks only for a globally assigned system role; campus-scoped system roles and globally assigned non-system roles do not bypass, and ordinary permission checks continue to work.
- [ ] AC-16: The unified medication queue contract keeps student required and non-null, excludes guardian, and preserves established nullability for class, avatar, dosage, notes, actor summaries, latest log, and latest outcome.

## Scenarios

### Scenario 1: Campus-local default date

**Given** a campus has an IANA timezone different from the server timezone
**When** the caller omits `date`
**Then** every section/count and the response date use one captured campus-local current date.

### Scenario 2: Partial health permission

**Given** the caller has `student_health.read` only
**When** daily items are requested
**Then** instructions/events are returned, medication access flags are false, medication values are zero/empty, and medication repositories are not called.

### Scenario 3: Administration permission without first-record authority

**Given** the caller has `medication_administration.read` and update but not create
**When** due medication work exists
**Then** the permitted rows/counts are visible but do not increase `actionRequired`.

### Scenario 4: Request awaiting caregiver

**Given** requests exist in SUBMITTED and NEEDS_MORE_INFO
**When** an authorized reviewer requests the summary
**Then** requestsNeedingReview and actionRequired include only SUBMITTED.

### Scenario 5: Summary-only sidebar refresh

**Given** the frontend requests `summaryOnly=true`
**When** the use case executes
**Then** it returns current counts/access metadata and no hydrated item rows.

### Scenario 6: Selected class

**Given** a valid class in the active campus
**When** the caller provides its ID
**Then** all authorized section totals and rows are limited to that class using canonical effective-enrollment semantics.

### Scenario 7: Completed request with missing outcome

**Given** an approved request is now COMPLETED but one occurrence remains unrecorded and overdue
**When** the selected date includes that occurrence
**Then** the occurrence remains in Today and counts as actionable for a caller with administration create permission.

### Scenario 8: Unauthorized cross-domain protection

**Given** the caller has only medication request list permission
**When** the endpoint is called
**Then** no instruction, event, or administration query executes and no cross-domain count is disclosed.

## Technical Notes

- The current `GetHealthCenterDailyItemsUseCase` already owns campus/date/class validation and independent instruction/event pagination; extend its application-layer orchestration rather than moving composition into the controller.
- Pass the authenticated domain user from the controller after the canonical permission guard, then derive effective campus capabilities with the shared application permission helpers. Do not let repositories infer authorization.
- Implement the global `user.hasSystemRole()` bypass centrally in `PermissionsGuard` as an isolated RBAC prerequisite/companion commit; do not add a Health Center-specific workaround.
- Reuse the mapping/status semantics of `GetDailyMedicationAdministrationsUseCase`; extract shared mapper/status helpers if needed rather than duplicating them.
- Request Needs Review counting requires a class-capable, status-specific repository count rather than loading request rows. Use the selected Health Center date for effective class enrollment, but use actual campus-local today from the captured `now` for effective expiration.
- Health Center event visibility must receive the request-captured `now`/cutoff rather than reading `Date.now()` inside the repository.
- Summary-only pagination must calculate `hasMore` from the requested page window because its item arrays are intentionally empty.
- Preserve the legacy medication-summary use case until all consumers migrate; its current all-permissions guard is not the permission model for the unified endpoint.

## Task Links

- @task-tx82v1 [health-unified-flow-backend-01] Centralize global Super Admin permission bypass
- @task-8jjj5d [health-unified-flow-backend-02] Define the additive unified daily API contract
- @task-elfc31 [health-unified-flow-backend-03] Add permission-aware health Today queries
- @task-89a9i1 [health-unified-flow-backend-04] Add medication administration Today work
- @task-ewlz1p [health-unified-flow-backend-05] Add medication request review counts
- @task-r1t0t9 [health-unified-flow-backend-06] Finalize unified orchestration and summary mode
- @task-xtpi58 [health-unified-flow-backend-07] Complete compatibility, documentation, and verification

## Open Questions

None. Endpoint evolution, authorization, count formulas, compatibility, and domain boundaries are resolved.
