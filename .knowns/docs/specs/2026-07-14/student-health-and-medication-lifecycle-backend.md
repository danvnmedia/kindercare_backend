---
title: Student Health and Medication Lifecycle Backend
description: Backend specification for uniform student health archival, campus-timezone correctness, medication request completion/expiration, and permission catalog cleanup.
createdAt: '2026-07-14T16:01:22.506Z'
updatedAt: '2026-07-14T16:44:30.221Z'
tags:
  - spec
  - approved
  - backend
  - student-health
  - medication
  - lifecycle
  - rbac
  - api
---

# Student Health and Medication Lifecycle Backend

## Overview

Complete the backend contracts required by the approved Student Health Management Frontend and close the identified medication-request lifecycle and permission-catalog gaps.

The existing Student Health V1 and medication request/administration workflows remain the foundation. This specification adds archive-only retention for student health records, campus-timezone correctness, automatic medication request completion/expiration, and RBAC catalog cleanup without merging health records with medication requests.

## Goals

- Provide a uniform, auditable archive contract for checkups, health instructions, and health events.
- Keep clinical event status separate from record-retention state.
- Make all medication date/time behavior deterministic in the campus’s local timezone.
- Persist meaningful terminal medication-request lifecycle states.
- Prevent scheduler lag or concurrency from permitting invalid medication workflow actions.
- Ensure the permission catalog contains only implemented staff capabilities.
- Preserve existing student medication history and Health Center read surfaces.

## Non-Goals

- Merging medication requests into student health instructions or health events.
- Adding medication prescriptions, attachments, or file upload.
- Adding hard deletion or restore for health records.
- Adding medication-request archival or reopening terminal requests.
- Auditing every health read.
- Redesigning parent or staff medication UX.
- Changing medication administration outcomes or requiring every occurrence to have an outcome before request completion.
- Implementing frontend components; the corresponding frontend contract is maintained separately.

## Existing Foundation

The implementation must extend rather than replace:

- student health profile/checkup/instruction/event use cases, repositories, Prisma mappers, DTOs, and controller routes;
- student-scoped medication history;
- parent and staff medication request workflows;
- medication administration occurrence materialization and outcome logging;
- Health Center daily items and medication summary;
- campus-scoped RBAC, audit recorder, transaction runner, and cron module;
- standard pagination/filtering and campus-isolation patterns.

The archived @doc/archive/research/health-center-backend-research is historical context only; current source code is authoritative where that document describes now-implemented aggregate endpoints.

## Locked Decisions

- D1: Scope includes the frontend-enabling health archive contract plus medication lifecycle transitions and permission cleanup. Attachments and broad workflow expansion are excluded.
- D2: `DELETE` endpoints perform recoverable health-record archival, require `student_health.delete`, return the archived record, and do not provide restore in this scope.
- D3: Checkups, instructions, and events use nullable `archivedAt` and `archivedByUserId` as authoritative archive metadata. API `isArchived` is derived. Event status is only `OPEN` or `RESOLVED`.
- D4: Unapproved requests become effectively `EXPIRED` at the start of the campus-local day after their requested window; approved requests become effectively `COMPLETED` at their final scheduled occurrence instant. Eligibility uses `now >= boundary`, and persisted `expiredAt`/`completedAt` store the effective boundary instant even when the write occurs later. Dose outcomes remain independent.
- D5: An idempotent reconciliation job runs every five minutes. It writes system timeline entries, while request commands enforce effective time boundaries independently. Reads do not write.
- D6: Add `student_health.delete` through the permission seed; remove unused `medication_request.create`, `medication_request.delete`, and `medication_administration.list` through migration and seed cleanup; retain active medication endpoint permissions; require both current read permissions for the combined medication summary.
- D7: Campus gains a required IANA timezone. Existing campuses are backfilled to `Asia/Ho_Chi_Minh`; medication and Health Center time calculations use campus-local time. Nonexistent DST wall times shift forward and repeated wall times use the earlier instant.
- D8: Archive is concurrency-safe and idempotent. An already-archived record is returned unchanged even if its student was subsequently archived; first-time archive for an archived student is rejected. Archived details remain readable, ordinary updates conflict, and active operational queries exclude archived records.
- D9: `REJECTED`, `CANCELLED`, `COMPLETED`, and `EXPIRED` are terminal request states. Workflow commands against terminal requests return conflict. Administration occurrences remain recordable/correctable afterward.
- D10: Campus create requires an explicit valid IANA timezone; campus read/update expose it. Frontend campus management must adapt to the contract.
- D11: A late command that discovers expiration must commit the one-time expiration and system timeline entry first, then return HTTP conflict outside the transaction.
- D12: Reconciliation is a trusted cross-campus system operation. Each run scans at most a configurable limit, initially 100, in stable non-starving order; every candidate carries campus/timezone context and mutations remain conditional on request ID, campus, and source status.
- D13: Existing `COMPLETED` and `EXPIRED` rows are backfilled from `updatedAt` as the best available terminal timestamp.
- D14: The Health Snapshot obtains the latest active checkup from the ordinary checkup list using `limit=1`, `offset=0`, `sort=-checkedAt`, and omitted `includeArchived`; no dedicated latest endpoint is added.

## Requirements

### Functional Requirements

#### Campus Timezone Contract

- FR-1: Add a non-null IANA `timeZone` field to Campus persistence and domain/API models.
- FR-2: Backfill every existing campus to `Asia/Ho_Chi_Minh` before applying the non-null constraint.
- FR-3: Campus creation must require `timeZone`; campus update may change it; campus reads must return it.
- FR-4: Invalid or unsupported IANA timezone identifiers must return a validation error.
- FR-5: Medication request boundaries, occurrence due instants, administration default dates/status derivation, overdue calculations, lifecycle transitions, Health Center default dates, and current-date enrollment filtering used by medication queries must use the selected campus timezone rather than server-local or UTC-calendar shortcuts.
- FR-6: Existing date-only values must remain date-only. A medication occurrence’s `dueDate` and `dueMinute` represent wall-clock campus-local time. Nonexistent spring-forward wall times must shift forward to the next valid instant, while repeated fall-back wall times must resolve to the earlier instant.
- FR-7: A campus timezone change must apply to subsequent interpretation of campus-local schedules; persisted date-only and minute values must not be silently converted or rewritten.

#### Health Archive Persistence

- FR-8: Add nullable `archivedAt` and `archivedByUserId` fields to StudentHealthCheckup, StudentHealthInstruction, and StudentHealthEvent.
- FR-9: `archivedByUserId` must reference the actor when available and use a deletion behavior that does not remove the health record; the append-only audit entry remains the durable actor record.
- FR-10: Add indexes supporting campus/student queries that exclude or include archived records.
- FR-11: Domain entities must expose archive state derived from `archivedAt` and an archive operation that sets actor/time once.
- FR-12: API list/detail responses for all three record types must expose `archivedAt`, `archivedByUserId`, and derived `isArchived`.
- FR-13: Remove `ARCHIVED` from StudentHealthEventStatus in domain, Prisma, DTO, OpenAPI, seed, and test contracts. Event clinical status must be `OPEN` or `RESOLVED`.
- FR-14: Migration of an existing event with status `ARCHIVED` must preserve it as archived metadata, set its clinical status to `RESOLVED`, use its existing update timestamp as the best available archive timestamp, and use its last-updated actor when available.

#### Health Archive API

- FR-15: Add these campus-scoped endpoints:
  - `DELETE /students/:studentId/health-checkups/:checkupId`
  - `DELETE /students/:studentId/health-instructions/:instructionId`
  - `DELETE /students/:studentId/health-events/:eventId`
- FR-16: Each archive endpoint must require campus access and `student_health.delete`.
- FR-17: Each archive operation must verify the student and record belong to the selected campus and requested student; cross-campus or mismatched ownership must return not found without revealing record existence.
- FR-18: First-time archival for a record belonging to an archived student must be rejected consistently with existing archived-student write rules. If the record was already archived before the student became archived, a repeated archive call remains idempotent and returns the archived record.
- FR-19: First archive must use a database-conditional write requiring `archivedAt IS NULL`, atomically set archive metadata, persist the record, and write one audit entry with before/after state and actor context.
- FR-20: Repeating or concurrently racing archive calls must return the persisted archived response without changing archive metadata or creating duplicate audit events; only the conditional-write winner may emit the audit entry.
- FR-21: Ordinary update use cases must condition writes on `archivedAt IS NULL`, reject archived records or archive-race losers with conflict, and not mutate them.
- FR-22: Detail endpoints must return archived records to callers with `student_health.read`.
- FR-23: Health record list queries must support an optional boolean `includeArchived`, defaulting to `false`; malformed non-boolean values must return validation error.
- FR-24: `includeArchived=false` or omission must return active records only; `includeArchived=true` must return active and archived records while preserving standard pagination, sorting, and other filters.
- FR-25: Active-instruction endpoints, class active-instruction endpoints, Health Center daily items, and open-event counts must always exclude archived records and must not accept an override. The Health Snapshot’s latest checkup must continue to use the ordinary list endpoint with `limit=1`, `offset=0`, `sort=-checkedAt`, and omitted `includeArchived`; that list may still accept `includeArchived=true` for explicit history browsing, and no dedicated latest endpoint is added.
- FR-26: Archive audit actions must be registered in the central audit action vocabulary and visibility mapping for checkups, instructions, and events.

#### Health Permission Contract

- FR-27: Add `student_health.delete` to the system permission catalog with archive-only wording.
- FR-28: The permission seed must add `student_health.delete` and grant it to Super Admin consistently with the existing catalog process; deployment must run the permission seed after migration.
- FR-29: No health archive endpoint may accept `student_health.update` as an alternative to `student_health.delete`.
- FR-30: Existing health read/create/update permissions and endpoint semantics must otherwise remain unchanged.

#### Medication Lifecycle Semantics

- FR-31: `SUBMITTED` and `NEEDS_MORE_INFO` requests become effectively `EXPIRED` when `now >=` the start of the campus-local calendar day after `endDate`; persistence occurs on the next reconciliation or guarded command.
- FR-32: An `APPROVED` request becomes effectively `COMPLETED` when `now >=` the campus-local due instant of its final materialized occurrence; persistence occurs on the next reconciliation.
- FR-33: If an approved request unexpectedly has no occurrences, reconciliation must use the start of the campus-local day after `endDate` as the completion boundary and emit diagnostic logging with request/campus context.
- FR-34: `REJECTED`, `CANCELLED`, `COMPLETED`, and `EXPIRED` are terminal request states.
- FR-35: Terminal requests must reject review, parent response, cancellation, reopening, or status reversal with conflict.
- FR-36: Existing occurrences belonging to `COMPLETED` requests must remain visible and recordable/correctable under existing medication administration permissions.
- FR-37: `EXPIRED` applies only to requests that were not approved before their requested window elapsed; an approved request must not become `EXPIRED` because administration outcomes are missing.
- FR-38: MedicationRequest persistence, domain models, mappers, and API responses must include nullable `completedAt` and `expiredAt`. Each terminal transition sets its corresponding field exactly once to the effective boundary instant, not the later commit instant. Existing `COMPLETED` and `EXPIRED` rows must backfill the matching timestamp from `updatedAt`. Request list/detail, parent list/detail, and student medication history must expose persisted terminal status/timestamps consistently; Health Center pending and needs-more-info counts must exclude terminal requests.

#### Medication Lifecycle Reconciliation

- FR-39: Add an application use case that reconciles eligible medication requests with a configurable maximum scan count, initially 100 per run, and returns scanned, completed, expired, skipped, and failed counts satisfying `scanned = completed + expired + skipped + failed`. Conditional-update losers or no-longer-eligible candidates count as skipped; caught per-request errors count as failed.
- FR-40: Register an infrastructure cron task that invokes reconciliation every five minutes.
- FR-41: Reconciliation is a trusted cross-campus system operation and must be idempotent and safe when multiple application replicas execute concurrently. Candidate rows must carry campus/timezone context and be selected in a stable order that cannot starve eligible rows behind future or failed rows.
- FR-42: Each status transition must use a conditional update keyed by request ID, campus ID, and eligible source statuses so only one worker wins.
- FR-43: A successful transition and its timeline entry must commit atomically.
- FR-44: Add medication timeline actions `COMPLETED` and `EXPIRED`, recorded with actor type `SYSTEM`.
- FR-45: Repeated reconciliation must not duplicate timeline entries or change terminal timestamps/status.
- FR-46: Per-request and cron-level failures must be logged with counts and request/campus context, must increment failed accounting where applicable, and must not prevent later candidates or later runs from retrying unprocessed requests.
- FR-47: Reconciliation must not perform medication administration outcome writes.

#### Medication Command-Time Guards

- FR-48: Staff review, parent response, and parent cancellation commands must capture one `now` value and evaluate the request’s effective campus-local time boundary inside their transactional workflow.
- FR-49: If a command encounters an otherwise-active request whose expiration boundary has passed, it must transactionally persist the one-time `EXPIRED` transition and system timeline entry, return an internal expiration result so the transaction commits, then reject the requested command with conflict outside the transaction.
- FR-50: Concurrency between commands and reconciliation must result in exactly one terminal transition and timeline entry.
- FR-51: Read endpoints must remain side-effect free and must not reconcile or write statuses.
- FR-52: A staff review must not approve a request after its expiration boundary, even during the interval before the next cron run.

#### Medication Permission Cleanup

- FR-53: Remove `medication_request.create`, `medication_request.delete`, and `medication_administration.list` from the system permission catalog.
- FR-54: A migration must delete corresponding RolePermission rows before deleting obsolete Permission rows, without affecting any active permission. The migration does not insert `student_health.delete`; that addition remains seed-owned.
- FR-55: Guardian medication creation must continue to rely on authenticated guardian ownership/campus rules rather than staff RBAC.
- FR-56: Existing active contracts remain:
  - medication request queue: `medication_request.list`;
  - medication request/student history detail: `medication_request.read`;
  - medication review: `medication_request.update`;
  - medication administration daily read: `medication_administration.read`;
  - first outcome record: `medication_administration.create`;
  - outcome correction: `medication_administration.update`.
- FR-57: `GET /health-center/medication-summary` must require both `medication_request.read` and `medication_administration.read`, not OR semantics.
- FR-58: The all-permissions enforcement for the combined summary must preserve Super Admin behavior and campus-scoped role resolution.
- FR-59: OpenAPI descriptions, permission tests, seeds, deployment documentation, and frontend/backend handoff documentation must match the cleaned catalog.

#### Cross-Domain Boundaries

- FR-60: Approving, completing, or expiring a medication request must not create or update a StudentHealthInstruction or StudentHealthEvent.
- FR-61: Student medication history remains the supported read integration between medication and Student Profile Health.
- FR-62: Health Center medication summary remains separate from health instruction/event daily items.
- FR-63: Health archive operations must not archive or mutate medication requests or administration occurrences.

### Non-Functional Requirements

- NFR-1: User-driven student-scoped queries and mutations must enforce campus and student ownership at the database boundary; campus aggregate operations must enforce campus scope; trusted reconciliation may scan across campuses but every candidate and conditional mutation must retain campus identity.
- NFR-2: Archive and lifecycle transitions must be transactional, concurrency-safe, idempotent, and retryable.
- NFR-3: No lifecycle or archive operation may physically delete a health or medication business record.
- NFR-4: Archive and lifecycle list queries must remain compatible with standard pagination/sorting/filtering response envelopes.
- NFR-5: Campus timezone conversions, including DST gap/fold disambiguation, must be deterministic under automated tests and independent of the machine’s `TZ` setting.
- NFR-6: The five-minute reconciliation must scan at most its configured limit per run, initially 100, use short per-request transactions, and avoid holding one transaction over the dataset.
- NFR-7: Multi-replica execution must not produce duplicate terminal transitions, timeline rows, or archive audit events.
- NFR-8: Schema migrations must be reversible where practical and safe against existing archived event data, existing terminal medication rows, and assigned obsolete permissions.
- NFR-9: OpenAPI output must describe timezone validation, archive metadata/filter behavior, conflict/not-found responses, and terminal medication statuses.
- NFR-10: Automated coverage must include domain, use-case, repository, controller/DTO, permission, cron, migration-sensitive mapping, timezone/DST, and concurrency cases.
- NFR-11: Focused health/medication tests, full type checking, and production build must pass before completion.
- NFR-12: Existing non-archive Student Health and medication workflow behavior must remain backward compatible except for the explicitly removed event `ARCHIVED` status and obsolete permissions.

## Acceptance Criteria

- [ ] AC-1: Campus create rejects a missing or invalid IANA timezone, and campus read/update round-trip the saved value.
- [ ] AC-2: Existing campuses migrate to `Asia/Ho_Chi_Minh`; campus-local defaults, due instants, boundaries, and DST gap/fold behavior remain deterministic under different server `TZ` settings.
- [ ] AC-3: Checkup, instruction, and event responses expose uniform archive metadata and derived `isArchived`.
- [ ] AC-4: Event status supports only `OPEN` and `RESOLVED`; migrated legacy archived events remain archived through archive metadata.
- [ ] AC-5: A caller with `student_health.delete` can archive each supported health record through its `DELETE` endpoint without physical deletion.
- [ ] AC-6: Sequential or concurrent repeat archive requests produce one conditional archive mutation and one audit event; archive-versus-update races cannot mutate an archived record.
- [ ] AC-7: Default lists and operational Health Center/active queries exclude archived records; `includeArchived=true` includes them in ordinary history; the Health Snapshot’s existing `limit=1&offset=0&sort=-checkedAt` request selects the latest active checkup when `includeArchived` is omitted.
- [ ] AC-8: Archived detail remains readable, while archived record update returns conflict.
- [ ] AC-9: Cross-campus, mismatched-student, first-time archived-student, malformed `includeArchived`, and missing-permission attempts are rejected without mutation; repeat archive of an already-archived record remains idempotent after its student is archived.
- [ ] AC-10: An unapproved request transitions once to `EXPIRED` at `now >=` its campus-local boundary, persists the effective boundary as `expiredAt`, and records one system timeline entry.
- [ ] AC-11: An approved request transitions once to `COMPLETED`, persists the effective final-occurrence boundary as `completedAt`, and does so regardless of missing outcomes.
- [ ] AC-12: Completed-request occurrences remain recordable and correctable; terminal request workflow actions return conflict.
- [ ] AC-13: A configurable reconciliation run scans at most 100 by default, preserves `scanned = completed + expired + skipped + failed`, isolates per-request failures, avoids starvation, and concurrent workers produce exactly one terminal transition/timeline entry.
- [ ] AC-14: Reads never write lifecycle state, and late command guards commit one expiration/timeline transition before returning conflict outside the transaction.
- [ ] AC-15: The seeded permission catalog contains `student_health.delete`; the migration and seed no longer retain the three obsolete medication permissions or their role assignments; deployment documentation requires the permission seed.
- [ ] AC-16: Health Center medication summary denies access unless the caller has both active medication read permissions or Super Admin access.
- [ ] AC-17: Medication lifecycle changes never create or mutate student health instructions/events.
- [ ] AC-18: OpenAPI, focused domain/use-case/repository/controller/permission/cron/concurrency tests, full type checking, and production build validate the finalized contracts.
- [ ] AC-19: MedicationRequest persistence, domain entities, Prisma mapper, and response DTOs expose nullable `completedAt`/`expiredAt`, and existing terminal rows backfill the matching timestamp from `updatedAt`.

## Scenarios

### Scenario 1: Archive A Checkup

**Given** an active student, active checkup, selected campus, and caller with `student_health.delete`  
**When** the caller deletes the checkup endpoint  
**Then** one conditional archive mutation, archive metadata, and one audit event are persisted atomically  
**And** the response contains the archived record without physical deletion.

### Scenario 2: Repeat Or Race Archive

**Given** a health record is already archived, or two callers race to archive it  
**When** the archive endpoint is called  
**Then** the current persisted archived record is returned  
**And** archive time, actor, and audit-event count do not change after the winning write  
**And** this remains idempotent if the student was archived after the health record.

### Scenario 3: Browse Archived History

**Given** active and archived records exist for one student  
**When** list is called without `includeArchived` and then with `includeArchived=true`  
**Then** the default response excludes archived records  
**And** the opt-in response includes both with correct pagination metadata  
**And** a malformed `includeArchived` value returns validation error.

### Scenario 4: Archived Record Is Operationally Inert

**Given** an archived instruction or event exists  
**When** active-instruction, open-event, or Health Center daily queries run  
**Then** the archived record is absent  
**And** a direct authorized detail read can still retrieve it.

### Scenario 5: Migrate Legacy Archived Event

**Given** an existing event has status `ARCHIVED` before migration  
**When** the migration completes  
**Then** it has status `RESOLVED`, archive metadata derived from existing update context, and remains absent from active queries.

### Scenario 6: Expire An Unapproved Request

**Given** a request is `SUBMITTED` or `NEEDS_MORE_INFO` and `now >=` its campus-local expiration boundary  
**When** reconciliation or a guarded command evaluates it  
**Then** it transitions once to `EXPIRED` with `expiredAt` equal to the effective boundary and one system timeline entry  
**And** a guarded command commits that transition before returning conflict outside its transaction.

### Scenario 7: Complete An Approved Request

**Given** `now >=` an approved request’s final scheduled campus-local occurrence instant  
**When** reconciliation runs  
**Then** the request transitions once to `COMPLETED` with `completedAt` equal to that effective boundary  
**And** missing or existing administration outcomes do not change the transition.

### Scenario 8: Record A Late Outcome

**Given** a request is `COMPLETED` and an occurrence remains unrecorded or requires correction  
**When** an authorized staff member records or corrects the outcome  
**Then** the administration log is updated under existing rules  
**And** the request remains `COMPLETED`.

### Scenario 9: Multi-Replica Reconciliation

**Given** two workers select the same eligible request  
**When** both attempt the terminal transition using request ID, campus ID, and source status  
**Then** conditional persistence allows one winner  
**And** exactly one timeline entry exists  
**And** the loser is counted as skipped.

### Scenario 10: Combined Summary Permission

**Given** a user has only one medication read permission  
**When** they request the combined medication summary  
**Then** access is denied  
**And** no counts from the other medication domain are returned.

### Scenario 11: Campus Timezone And DST Boundary

**Given** campuses have different IANA timezones and identical local schedule values  
**When** reconciliation evaluates them at the same UTC instant  
**Then** each request transitions according to its own campus-local boundary  
**And** nonexistent local times shift forward while repeated local times resolve to the earlier instant.

### Scenario 12: Health Snapshot Latest Checkup

**Given** active and archived checkups exist  
**When** the Health Snapshot calls the ordinary checkup list with `limit=1`, `offset=0`, `sort=-checkedAt`, and no `includeArchived`  
**Then** the first row is the latest active checkup  
**And** no dedicated latest-checkup endpoint is required.

### Scenario 13: Bounded Reconciliation

**Given** more eligible requests exist than the configured default limit of 100 and one candidate fails  
**When** reconciliation runs repeatedly  
**Then** each run scans at most its limit  
**And** failures are counted without aborting later candidates  
**And** stable eligibility ordering does not permanently starve remaining rows.

## Technical Notes

- Prefer a shared archive value object/helper for archive metadata while retaining domain-specific repositories and audit action names.
- Implement archive mutations with the existing transaction runner and audit recorder, but use a database-conditional `archivedAt IS NULL` update so only the winner emits audit.
- Add composite indexes shaped around `campusId`, `studentId`, archive state, and current sort columns.
- Treat `archivedAt IS NULL` as active; do not persist a redundant boolean archive column.
- For legacy event migration, remove the Prisma/PostgreSQL `ARCHIVED` enum value using a safe type-replacement migration after data conversion.
- Add medication terminal timestamps and backfill existing matching terminal rows from `updatedAt`.
- Use a reusable IANA timezone validator and campus-local date/time conversion service rather than process-global timezone mutation; centralize the accepted DST disambiguation policy.
- Reconciliation should query only currently eligible candidates in stable order, cap each invocation at its configured limit, and use short per-request transactions.
- Conditional terminal updates should include request ID, campus ID, and source status in the database predicate and set `completedAt` or `expiredAt` in the same write. Timeline insert occurs only for the successful updater.
- A guarded late command must return an internal sentinel/result from the transaction so expiration commits, then throw HTTP conflict outside the transaction.
- Extend the existing cron module, but add explicit counts and request/campus context because existing cron logs are primarily interpolated text rather than a reusable structured logging contract.
- The current PermissionsGuard is OR-based; enforce both summary permissions with an explicit all-permissions policy/guard rather than passing two values to the existing decorator or changing existing OR behavior.
- Add `student_health.delete` through the seed and document/run permission seeding after deployment; the migration only deletes obsolete medication role-permission and permission rows.
- Update health-center seed fixtures and medication factories for timezone, DST, legacy timestamp, and lifecycle boundary cases.
- Relevant references: @doc/architecture/audit-trail-soft-delete-patterns, @doc/guides/pagination-and-filtering, @doc/patterns/use-case-pattern, @doc/patterns/testing-pattern, and @doc/patterns/prisma-migration-patterns.
- Approved frontend counterpart in the frontend Knowns project: `specs/2026-07-14/student-health-management-frontend`.

## Task Links

- @task-ut1jcp [health-med-lifecycle-01] Add campus timezone contract
- @task-pti8um [health-med-lifecycle-02] Apply campus-local time semantics
- @task-1v57d8 [health-med-lifecycle-03] Add health archive persistence
- @task-11a6xi [health-med-lifecycle-04] Implement health archive commands
- @task-31vwj3 [health-med-lifecycle-05] Make health reads archive-aware
- @task-osvfqe [health-med-lifecycle-06] Add medication terminal persistence
- @task-yfshau [health-med-lifecycle-07] Implement lifecycle reconciliation
- @task-gf8xnd [health-med-lifecycle-08] Enforce medication command-time guards
- @task-2ne7mk [health-med-lifecycle-09] Align health and medication RBAC
- @task-uowczz [health-med-lifecycle-10] Finalize contracts and verification

## Open Questions

None.
