---
title: Future Enrollment Status and Cancellation Backend
description: Specification for authoritative date-effective enrollment statuses, future registration cancellation, non-overlapping scheduled class placements, roster/count migration, and lifecycle/history integration.
createdAt: '2026-07-11T14:35:45.489Z'
updatedAt: '2026-07-11T14:52:22.593Z'
tags:
  - spec
  - approved
  - backend
  - enrollment
  - school-year
  - cancellation
  - effective-status
---

## Overview

Define a coherent backend model for future-dated school-year registrations and class enrollments. The backend will distinguish calendar-effective status from structural row state, expose authoritative `UPCOMING | ACTIVE | CLOSED | CANCELLED` statuses, support atomic cancellation of future registrations and their upcoming class placements, and correct every current read/mutation path that equates a null end/exit date with active today.

This is a development-phase contract migration. Existing frontend and backend consumers must move to the new effective-status contract in the same change; no compatibility period is required.

Research input: @doc/research/future-enrollment-status-and-cancellation-backend-research

Frontend handoff: @doc/frontend-handoff/future-enrollment-status-and-cancellation-frontend-handoff

Related implemented systems:

- @doc/specs/2026-07-07/enrollment-flow-redesign-backend-companion
- @doc/specs/2026-07-07/school-year-student-history-views-backend-companion
- @doc/specs/2026-07-07/historical-snapshot-retention-backend-companion
- @doc/specs/2026-07-10/school-year-lifecycle-redesign-backend

Attendance mutation and historical attendance behavior remain out of scope.

## Locked Decisions

- D1: Cancelling a future school-year registration retains the parent and applicable child rows as `CANCELLED`. The backend stores cancellation time, a required reason code, an optional note of at most 500 characters, and a stable cancelling-actor summary. Parent cancellation atomically cancels every uncancelled upcoming child under that parent while leaving already closed or already cancelled historical children unchanged.
- D2: Effective status uses the authoritative UTC calendar date. Enrollment and end/exit dates are date-only. End/exit dates are inclusive: a row remains `ACTIVE` through that date and becomes `CLOSED` on the following UTC day. The backend returns authoritative `effectiveStatus` on all relevant parent/child DTOs. V1 does not expose a public caller-supplied `asOf` parameter.
- D3: A student may have current and future class placements concurrently when every uncancelled enrollment interval is non-overlapping across all classes and school years. An overlapping mutation is rejected with a stable conflict; it never automatically closes another row. School Year Lifecycle may close the source and create the future target atomically.
- D4: `POST /api/school-year-enrollments/:id/cancel` is idempotent after successful cancellation and must not duplicate audit events. If the row becomes effective before cancellation commits, the backend returns `409 ENROLLMENT_ALREADY_EFFECTIVE` with current status and `WITHDRAW` recovery guidance. Cancellation requires `school_year_enrollment.cancel` in the selected campus. Cancelled never-effective class placements remain history-visible but are excluded from active, upcoming, and historical enrollment-period counts.
- D5: The roster/status migration is a clean break. `includeHistorical` is replaced by authoritative `effectiveStatus` filtering, all callers migrate together, and the school-year student API adds an `upcoming` segment. Cancellation immediately reconciles uncommitted School Year Lifecycle state, while committed results remain immutable. Cancelled rows finalize at `cancelledAt` and enter the existing retention workflow.
- D6: V1 cancellation reasons are `FAMILY_REQUEST`, `CHANGED_SCHOOL`, `DUPLICATE_REGISTRATION`, `DATA_ENTRY_ERROR`, and `OTHER`. A reason is required; the optional note remains optional for every reason, including `OTHER`.

## Requirements

### Functional Requirements

#### Effective Status Model

- FR-1: The backend must expose one shared `EnrollmentEffectiveStatus` contract with exactly `UPCOMING`, `ACTIVE`, `CLOSED`, and `CANCELLED` for both `SchoolYearEnrollment` and class-level `Enrollment`.
- FR-2: Effective status must be derived against the authoritative current UTC date rather than persisted as a time-changing field.
- FR-3: Status precedence must be: `CANCELLED` when cancellation metadata exists; `UPCOMING` when uncancelled and `enrollmentDate` is after the reference date; `CLOSED` when uncancelled and a non-null end/exit date is before the reference date; otherwise `ACTIVE`.
- FR-4: End/exit dates must be inclusive. A row with an end/exit date equal to the reference date is `ACTIVE` for that date.
- FR-5: Pure status derivation must accept an explicit reference date for deterministic unit testing, while public V1 current-state APIs use the server's current UTC date and do not accept `asOf`.
- FR-6: Structural concepts such as uncancelled, open-ended, scheduled closure, and effective-active must use distinct application/repository vocabulary; code must not redefine every null-end query as effective-active implicitly.
- FR-7: Cancellation metadata and end/exit metadata must remain semantically separate. A cancelled row must not receive a fabricated end/exit date or `ExitReason`.

#### Cancellation Persistence and State Transition

- FR-8: Both parent and child enrollment records must persist cancellation time, cancellation reason, optional cancellation note, and cancelling actor identity/display snapshot sufficient to return `cancelledBy: { id, fullName }` after later reads.
- FR-9: Cancellation metadata must preserve these invariants: uncancelled rows have all required cancellation fields null; cancelled rows have `cancelledAt`, a valid reason, and cancelling actor ID set; note and actor display name may be null only where their contracts allow it.
- FR-10: The backend must provide `POST /api/school-year-enrollments/:id/cancel`.
- FR-11: The cancellation request body must require `cancellationReason` from D6 and may include `note` as a trimmed string of at most 500 characters. It must not accept an exit date.
- FR-12: A parent is cancellable only when its authoritative status at transaction time is `UPCOMING`.
- FR-13: Cancellation must resolve children by `schoolYearEnrollmentId`, never by a global active-enrollment lookup for the student.
- FR-14: In one transaction, parent cancellation must cancel every uncancelled child under that parent whose status is `UPCOMING`.
- FR-15: Already cancelled child rows and closed historical child rows must remain unchanged. If an `ACTIVE` child exists under an otherwise upcoming parent, cancellation must fail atomically with `CANCELLATION_CHILD_STATE_CONFLICT`.
- FR-16: Parent update, applicable child updates, Lifecycle reconciliation, historical finalization metadata, and the cancellation audit event must share one atomic transaction or an equivalent consistency boundary that prevents a partially cancelled result.
- FR-17: A successful response must return `resultStatus: CANCELLED`, the authoritative parent DTO, affected child DTOs and IDs, affected child count, and `idempotentReplay: false`.
- FR-18: Repeating cancellation on an already cancelled parent must return HTTP 200 with the original authoritative cancellation state and affected child scope, set `idempotentReplay: true`, and emit no duplicate mutation or audit event.
- FR-19: If the parent becomes effective before the conditional cancellation write succeeds, the operation must apply no changes and return HTTP 409 with code `ENROLLMENT_ALREADY_EFFECTIVE`, `currentStatus: ACTIVE`, and `action: WITHDRAW`.
- FR-20: A closed parent must return HTTP 409 `ENROLLMENT_ALREADY_CLOSED`; an unsupported active-child inconsistency must return HTTP 409 `CANCELLATION_CHILD_STATE_CONFLICT`; a concurrent state change not classifiable as those states must return HTTP 409 `ENROLLMENT_CANCELLATION_CONCURRENT_MODIFICATION`.
- FR-21: A missing or cross-campus parent must return the existing campus-hidden 404 behavior without disclosing that the resource exists elsewhere.
- FR-22: Validation failures for reason or note must return HTTP 400 using the existing validation envelope.

#### Interval Integrity and Enrollment Mutations

- FR-23: The backend must permit multiple uncancelled class-enrollment periods for one student only when their inclusive date intervals do not overlap.
- FR-24: The non-overlap invariant must apply across all classes and school years, not only within one school year.
- FR-25: A null end date represents an interval extending indefinitely for overlap validation. Cancelled rows do not participate in the overlap invariant.
- FR-26: Creating, bulk creating, transferring, Lifecycle-promoting, or otherwise opening a class enrollment that overlaps another uncancelled interval must return a stable `ENROLLMENT_PERIOD_OVERLAP` conflict with the conflicting enrollment/class/date context permitted by campus access.
- FR-27: An overlap conflict must never auto-close or rewrite the existing enrollment.
- FR-28: Readiness endpoints must evaluate class and parent enrollment eligibility at the requested effective date, distinguishing current effective enrollment, future scheduled enrollment, scheduled closure, cancelled rows, and genuine overlap conflicts.
- FR-29: Parent registration gates must evaluate whether the parent covers the requested enrollment date; they must not rely only on `exitDate IS NULL`.
- FR-30: The existing parent uniqueness rule must allow a replacement registration after cancellation while continuing to prevent competing uncancelled open parents for the same student and school year.

#### Read Contracts, Rosters, Segments, and Counts

- FR-31: Parent history DTOs returned by `GET /api/students/:studentId/school-year-enrollments` must add `effectiveStatus`, `cancelledAt`, `cancellationReason`, `cancellationNote`, and nullable `cancelledBy`.
- FR-32: Child history/roster DTOs returned by `GET /api/students/:studentId/enrollments` and class roster reads must expose the same effective-status and cancellation fields.
- FR-33: For cancelled records, end/exit date and exit reason remain null unless they were validly closed before cancellation; ordinary cancellation of a never-effective row must not manufacture closure data.
- FR-34: `GET /api/classes/:id/enrollments` must remove `includeHistorical` and replace it with a single `effectiveStatus` query accepting `ACTIVE`, `UPCOMING`, `CLOSED`, `CANCELLED`, or `ALL`. Omission must default to `ACTIVE`.
- FR-35: The clean-break migration must remove the old `includeHistorical` request contract and update controller documentation, validation, tests, and all known callers in the same delivery.
- FR-36: `GET /api/classes` must expose exactly named `activeStudentCount`, `upcomingStudentCount`, and `historicalStudentCount` projections. The compatibility alias `studentCount` must be removed.
- FR-37: `activeStudentCount` counts only `ACTIVE` child enrollments, `upcomingStudentCount` counts only `UPCOMING`, and `historicalStudentCount` counts only `CLOSED`. `CANCELLED` contributes to none of these counts.
- FR-38: Parent `childEnrollmentCount` must exclude cancelled never-effective child rows so it remains an enrollment-period count rather than a retained-record count.
- FR-39: `GET /api/school-years/:schoolYearId/students` must add the `upcoming` segment and derive every segment using the shared effective-status boundary.
- FR-40: The `upcoming` school-year segment must return rows whose parent registration is `UPCOMING`, including their upcoming class-assignment summary when one exists.
- FR-41: The `active` school-year segment must require an `ACTIVE` parent and `ACTIVE` class assignment. The `unassigned` segment must require an `ACTIVE` parent without an active or upcoming class assignment. Existing withdrawn/completed/graduated/unresolved semantics remain based on valid closed parent outcomes.
- FR-42: School-year class-assignment state must align with the authoritative status vocabulary and distinguish `UPCOMING`, `ACTIVE`, `CLOSED`, `CANCELLED`, and `NONE`; it must not label every null-end child as `ACTIVE`.
- FR-43: Search, sorting, pagination totals, roster results, and class counts must use the same effective-status predicates for one request boundary.

#### Student Phase and Adjacent Consumers

- FR-44: The `student_with_phase` SQL view must project `ACTIVE` and `currentClass` only from a class enrollment effective on the current UTC date.
- FR-45: An upcoming child placement must not project the student as `ACTIVE` or replace the current class before its enrollment date.
- FR-46: When no effective-active class exists, an uncancelled upcoming parent registration may continue to project the existing public `DEFERRED` phase; cancelled parents must not influence phase.
- FR-47: Eligible-student reads must use corrected effective phase/current-class behavior and must not exclude a student merely because a future placement exists.
- FR-48: Class-scoped medication-request staff queries and any other identified null-end current-class consumers must use the same current effective-enrollment predicate so future placements do not leak into present operational lists.
- FR-49: Date-selected Student Health and medication queries that already use inclusive interval semantics must remain behaviorally consistent.

#### Authorization and Audit

- FR-50: The cancellation endpoint must require JWT authentication, selected-campus access, resource-level campus ownership, and the explicit campus-scoped `school_year_enrollment.cancel` permission.
- FR-51: The permission must be added to the system permission catalog, follow existing RBAC module/id conventions, and be covered by guard tests including wrong-campus permission assignments.
- FR-52: Successful first-time cancellation must emit one `CANCEL_SCHOOL_YEAR_ENROLLMENT` audit event inside the cancellation transaction.
- FR-53: The audit event must include actor, campus, student, parent ID, school year, scheduled enrollment date, reason, note where allowed, affected child IDs/count, Lifecycle reconciliation context, and before/after status.
- FR-54: Idempotent replay must not emit a second cancellation audit event.
- FR-55: Audit action exports, visibility mappings, context-shape documentation, and exhaustiveness tests must remain synchronized.

#### School Year Lifecycle Reconciliation

- FR-56: Cancelling a parent associated with an uncommitted Lifecycle candidate must mark that candidate `NO_LONGER_ELIGIBLE`, exclude it from remaining-work counts, and make updated progress immediately observable.
- FR-57: Current uncommitted Lifecycle previews containing the affected candidate must be invalidated during cancellation with stable invalidation context.
- FR-58: A candidate/result that was already successfully committed must remain immutable inside Lifecycle. Cancelling its future target registration is an external enrollment correction and must not rewrite the persisted successful commit result.
- FR-59: Lifecycle progress after cancellation must remain internally consistent: an uncommitted cancelled candidate is excluded, while a previously committed candidate remains complete.
- FR-60: Candidate refresh, preview, commit, and retry must treat cancelled parent/child rows as ineligible and must never recreate or recommit them without a new valid registration workflow.

#### History, Retention, and Migration

- FR-61: Cancelling parent and child rows must set historical finalization to the cancellation timestamp without overwriting their captured display snapshots.
- FR-62: Cancelled rows must participate in existing correction, archive, retention-policy, legal-hold, redaction, export, and hard-delete protection behavior as finalized historical records.
- FR-63: History and export projections must include cancellation metadata and clearly distinguish cancellation from withdrawal/transfer/completion/graduation.
- FR-64: The database migration must add cancellation storage without classifying any existing row as cancelled or rewriting valid enrollment/end/exit dates.
- FR-65: Cancellation-aware parent uniqueness and class interval-integrity constraints must be database-enforced or provide an equivalently race-safe guarantee under concurrent writes.
- FR-66: Migration must preflight existing class-enrollment intervals for conflicts. If unresolved overlaps exist, deployment must stop with actionable diagnostics rather than silently delete, close, or rewrite enrollment history.
- FR-67: The migration must rebuild `student_with_phase` and update partial/exclusion indexes or constraints using the repository's reviewed PostgreSQL/Prisma raw-migration conventions.
- FR-68: Development clients must migrate to the new roster filter, explicit counts, status fields, and cancellation contract in the same release; no deprecated compatibility fields or query paths are required.

#### Isolation

- FR-69: Cancellation, effective-status reads, interval validation, Lifecycle reconciliation, migration, and retries must not create, update, delete, migrate, or recalculate attendance records.

### Non-Functional Requirements

- NFR-1: Effective-status derivation and UTC date-only normalization must be centralized and deterministic across domain, application, repository, DTO, SQL-view, and test seams.
- NFR-2: Cancellation must be atomic across parent, children, Lifecycle reconciliation, finalization metadata, and audit.
- NFR-3: Concurrent cancellation, enrollment, transfer, and Lifecycle writes must preserve interval and cancellation invariants without lost updates or duplicate audit events.
- NFR-4: Campus and permission failures must not disclose cross-campus resource existence.
- NFR-5: Active/upcoming/closed roster queries and class counts must remain efficient for campuses with thousands of current and historical enrollment rows and must use suitable indexes.
- NFR-6: Paginated result totals and count projections must be computed from the same status boundary as returned rows.
- NFR-7: Breaking API changes are acceptable only as one coordinated development migration with updated OpenAPI documentation and all repository consumers/tests changed together.
- NFR-8: Cancellation/history data must preserve existing snapshot, retention, and audit durability guarantees.
- NFR-9: Stable machine-readable error codes must be used for every state-specific cancellation and overlap outcome required by the frontend.
- NFR-10: No operation in this feature may mutate attendance data.
- NFR-11: Migration SQL must be forward-safe, data-preserving, schema-aligned, and validated through Prisma validation/generation plus migration-focused tests.
- NFR-12: The implementation must follow the existing Clean Architecture dependency rule: domain state/derivation, application orchestration and ports, Prisma adapters, HTTP DTO/controllers, and module wiring remain separated.

## Acceptance Criteria

- [ ] AC-1: A parent and child dated September 1 return `UPCOMING` on July 11 and do not appear in active roster/count/current-class results.
- [ ] AC-2: On September 1 UTC, those uncancelled rows return `ACTIVE` without a persisted status update or scheduled job.
- [ ] AC-3: A row remains `ACTIVE` on its inclusive end/exit date and returns `CLOSED` the following UTC date.
- [ ] AC-4: Parent history, child history, class roster, and school-year list DTOs return the same authoritative effective-status vocabulary and cancellation metadata.
- [ ] AC-5: An authorized user can cancel an `UPCOMING` parent without supplying an exit date.
- [ ] AC-6: Cancellation atomically marks the parent and every applicable upcoming child `CANCELLED`, records reason/note/actor/time, finalizes history, reconciles uncommitted Lifecycle state, and writes one audit event.
- [ ] AC-7: Closed historical and already cancelled child rows under the parent remain unchanged; an active-child inconsistency causes a full rollback with `CANCELLATION_CHILD_STATE_CONFLICT`.
- [ ] AC-8: Repeating a successful cancellation returns HTTP 200 with the original authoritative result and no second audit event.
- [ ] AC-9: Cancellation racing the enrollment start returns `409 ENROLLMENT_ALREADY_EFFECTIVE` with `currentStatus: ACTIVE` and `action: WITHDRAW`, with no partial mutation.
- [ ] AC-10: Closed, concurrently changed, invalid, missing, cross-campus, and unauthorized requests return the documented stable 400/403/404/409 outcomes.
- [ ] AC-11: A user may have current and future class periods when their inclusive intervals do not overlap.
- [ ] AC-12: Every single, bulk, transfer, and Lifecycle mutation that would create an uncancelled overlap returns `ENROLLMENT_PERIOD_OVERLAP` and changes no enrollment dates automatically.
- [ ] AC-13: Cancelling a future row releases the relevant uniqueness/interval constraint so a replacement valid registration or placement can be created.
- [ ] AC-14: `GET /api/classes/:id/enrollments` supports the new status filter/default/ALL contract and no longer accepts or documents `includeHistorical`.
- [ ] AC-15: `GET /api/classes` returns active/upcoming/historical counts using effective date semantics, excludes cancelled rows, and no longer exposes `studentCount`.
- [ ] AC-16: `GET /api/school-years/:schoolYearId/students?segment=upcoming` returns future registrations with upcoming class context, while active/unassigned segments no longer classify future rows as active.
- [ ] AC-17: Student phase/current class, eligible-student reads, and adjacent current-class filters do not treat future placements as effective today.
- [ ] AC-18: A Lifecycle-created future source closure and future target start keep the source effective until its inclusive closure boundary and do not expose the target early.
- [ ] AC-19: Cancelling an uncommitted Lifecycle candidate invalidates affected previews, marks the candidate `NO_LONGER_ELIGIBLE`, and refreshes progress; committed results remain immutable.
- [ ] AC-20: Cancelled rows remain readable/exportable as finalized historical records and follow existing retention/legal-hold/redaction rules.
- [ ] AC-21: The migration preserves existing rows and refuses unresolved interval conflicts with actionable diagnostics.
- [ ] AC-22: Permission tests prove that `school_year_enrollment.cancel` is required in the selected campus and a permission assigned only in another campus is insufficient.
- [ ] AC-23: Focused tests cover UTC midnight boundaries, inclusive end dates, cancellation reasons, optional note trimming/length, actor projection, idempotency, concurrency, counts, pagination totals, and SQL-view behavior.
- [ ] AC-24: Cancellation and every effective-status/Lifecycle path leave attendance records unchanged.
- [ ] AC-25: Prisma validation/generation, migration verification, focused tests, build, and spec verification pass.

## Scenarios

### Scenario 1: Future Registration and Placement

**Given** a student has a future school-year registration and class placement dated September 1  
**When** current-state APIs are queried in July  
**Then** both rows are `UPCOMING`, the future class appears only in upcoming results/counts, and the student's current phase/class is not moved early.

### Scenario 2: Automatic Effective Transition

**Given** an uncancelled upcoming registration  
**When** the authoritative UTC date reaches its enrollment date  
**Then** the backend returns `ACTIVE` without a row update or background transition job.

### Scenario 3: Inclusive Scheduled Closure

**Given** a current source enrollment with a future end date and a non-overlapping target enrollment beginning the next day  
**When** queried on the source end date  
**Then** the source remains `ACTIVE`; on the next date the source is `CLOSED` and the target is `ACTIVE`.

### Scenario 4: Atomic Cancellation

**Given** an upcoming parent with two upcoming children and one already cancelled historical child  
**When** an authorized user cancels with a valid reason  
**Then** the parent and two upcoming children are cancelled atomically, the historical child is unchanged, one audit event is written, and the response identifies the two affected children.

### Scenario 5: Idempotent Retry

**Given** a cancellation succeeded but the frontend did not receive the response  
**When** it retries the same parent cancellation  
**Then** the backend returns the existing cancelled state with `idempotentReplay: true` and creates no duplicate audit event.

### Scenario 6: Enrollment Becomes Effective During Confirmation

**Given** the cancellation dialog opened while the parent was upcoming  
**When** the UTC date boundary passes before the write commits  
**Then** cancellation applies no changes and returns `ENROLLMENT_ALREADY_EFFECTIVE` with `WITHDRAW` guidance.

### Scenario 7: Overlapping Future Placement

**Given** a student's current uncancelled class interval has no end before a requested future class start  
**When** enrollment or readiness is attempted  
**Then** the backend returns `ENROLLMENT_PERIOD_OVERLAP` and does not auto-close the current row.

### Scenario 8: Non-Overlapping Current and Future Placement

**Given** the current interval has an inclusive end date of August 31  
**When** a target placement beginning September 1 is created  
**Then** both rows coexist and each appears only in the status segment effective for the current UTC date.

### Scenario 9: Clean-Break Roster Migration

**Given** a caller previously used `includeHistorical=true`  
**When** the new contract is deployed  
**Then** the caller uses `effectiveStatus=ALL`; the old query field and `studentCount` alias are absent from the supported contract.

### Scenario 10: Lifecycle Reconciliation Before Commit

**Given** an uncommitted Lifecycle candidate and current preview reference an upcoming registration  
**When** that registration is cancelled  
**Then** the preview is invalidated, the candidate becomes `NO_LONGER_ELIGIBLE`, and run progress immediately excludes it.

### Scenario 11: Cancellation After Lifecycle Commit

**Given** Lifecycle successfully created a future target registration  
**When** that target is cancelled before becoming effective  
**Then** the enrollment cancellation is recorded outside Lifecycle, while the persisted successful Lifecycle result remains immutable and auditable.

### Scenario 12: Retained Cancelled History

**Given** a cancelled registration reaches a later history/export/retention workflow  
**When** it is read or processed  
**Then** it remains distinguishable from withdrawal, carries cancellation metadata and snapshots, and follows the existing finalized-record policy.

### Scenario 13: Cross-Campus and Permission Protection

**Given** a user lacks the cancellation permission in the selected campus or targets another campus's parent ID  
**When** cancellation is requested  
**Then** the backend returns the established 403 or campus-hidden 404 response and changes no enrollment, Lifecycle, or audit state.

### Scenario 14: Attendance Isolation

**Given** any cancellation, retry, migration, status query, readiness check, or Lifecycle reconciliation path  
**When** it runs  
**Then** no attendance record is created, updated, deleted, migrated, or recalculated.

## Technical Notes

- Follow the existing pure derived-status precedent in `deriveStudentHealthInstructionStatus`, with a shared UTC date-only reference boundary.
- Keep time-dependent `effectiveStatus` in read projections/DTOs or a derived domain function; persist only cancellation facts.
- Reuse `TransactionRunnerPort`, repository ports, immutable domain transitions, and `AuditEventRecorderPort` for the parent/children/Lifecycle/audit atomic boundary.
- Use a parent-scoped child query. Do not reuse the current global `findActiveByStudentId` lookup for cancellation.
- Use a conditional write/CAS-style persistence operation so the status is revalidated at commit time without requiring a public expected-version field in V1.
- The interval invariant may use a PostgreSQL exclusion constraint or another database-enforced race-safe design. Cancelled rows must be excluded, and inclusive date ranges must match D2.
- Update raw migration SQL and schema comments according to @doc/patterns/prisma-migration-patterns.
- Rebuild `student_with_phase` from effective interval predicates and current UTC date; writes remain on base tables.
- Keep list/count projections out of write aggregates according to @doc/patterns/read-projection-patterns.
- Store or snapshot the cancelling display name so the direct history contract does not depend solely on replaying audit events.
- Preserve standard response envelopes and existing campus-hidden not-found conventions.
- Remove rather than deprecate `includeHistorical` and `studentCount` because D5 authorizes a coordinated development migration.
- Detailed file sequencing and task decomposition belong in Knowns Tasks generated after approval.

## Task Links

- @task-egydnm [future-enrollment-status-and-cancellation-backend-01] Effective-status and cancellation domain contracts
- @task-id213u [future-enrollment-status-and-cancellation-backend-02] Cancellation persistence and interval-integrity migration
- @task-it57u5 [future-enrollment-status-and-cancellation-backend-03] Date-effective repository and enrollment mutation semantics
- @task-wydxri [future-enrollment-status-and-cancellation-backend-04] Atomic future enrollment cancellation workflow
- @task-dbplov [future-enrollment-status-and-cancellation-backend-05] Cancellation HTTP, RBAC, and audit contract
- @task-jtn60v [future-enrollment-status-and-cancellation-backend-06] Class roster and count clean-break migration
- @task-00w1a9 [future-enrollment-status-and-cancellation-backend-07] School-year and enrollment history status projections
- @task-2oo2gx [future-enrollment-status-and-cancellation-backend-08] Student phase, current class, and adjacent operational reads
- @task-zjyfpp [future-enrollment-status-and-cancellation-backend-09] Lifecycle reconciliation and retained cancellation history
- @task-71d8e7 [future-enrollment-status-and-cancellation-backend-10] Cross-flow verification and migration readiness

## Open Questions

None. The exploration pass resolved cancellation representation, reason/actor metadata, child scope, UTC and date boundaries, authoritative status ownership, concurrent scheduling, overlap behavior, idempotency/race recovery, permission, counts, roster migration, Lifecycle reconciliation, and retention.
