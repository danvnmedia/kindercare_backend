---
title: School Year Lifecycle Redesign Backend
description: Specification for resumable, grade/class-scoped school-year lifecycle operations, persisted decisions, progress, preview/commit, concurrency, and retention.
createdAt: '2026-07-10T15:40:17.067Z'
updatedAt: '2026-07-10T15:46:48.173Z'
tags:
  - spec
  - approved
  - school-year
  - lifecycle
  - backend
  - api
  - resumable-workflow
---

## Overview

This specification defines the backend change required by @doc/frontend-handoff/school-year-lifecycle-redesign-frontend-handoff. It extends the implemented preview-and-commit rollover foundation from @doc/specs/2026-07-07/school-year-lifecycle-backend-companion with a resumable, campus-scoped lifecycle operation organized by grade and class.

The backend will own candidate membership, saved decisions, authoritative progress, concurrency, scoped preview/commit state, and persisted results for campuses with approximately 100 to 2,000 students. Existing enrollment lifecycle rules, retry-safe per-student commit transactions, audit behavior, date-only semantics, and the rule that attendance is never mutated remain in force.

Supporting research: @doc/research/school-year-enrollment-backend-companion-research and proposed project memory 8cj3ip.

## Locked Decisions

- D1: A campus may have only one active lifecycle run per source school year. The target year and lifecycle dates may be edited until the first successful commit; edits invalidate previews. The run may be cancelled only before that commit. Afterward setup is immutable and the run must reach reconciliation or completion.
- D2: A run snapshots eligible source registrations. Explicit refresh adds newly eligible students as NOT_STARTED, moves changed students to their current grade/class scope, preserves compatible decisions, clears incompatible target assignments, and marks changed rows NEEDS_REVIEW. Ineligible rows remain as NO_LONGER_ELIGIBLE, retain history, and are excluded from remaining-work counts.
- D3: Preview and commit may target a grade, one or more classes within that grade, or explicit students. Oversized scopes return guidance for smaller class-based scopes. An oversized individual class is divided into deterministic student batches, each separately previewed and committed.
- D4: SUCCESS, ALREADY_APPLIED, and reviewed SKIP rows count as complete. NO_LONGER_ELIGIBLE rows are excluded. Conflicts, failures, and review-required rows keep scopes incomplete. Successfully committed rows are immutable within Lifecycle; later corrections use established enrollment/correction workflows.
- D5: Editing uses optimistic version checks with 409 stale-state responses. Non-overlapping previews may coexist. A new overlapping preview supersedes the older preview, setup changes invalidate all previews, and otherwise-valid previews expire after 24 hours.
- D6: The API uses explicit school_year_lifecycle.read, school_year_lifecycle.manage, school_year_lifecycle.preview, and school_year_lifecycle.commit permissions. Preparation and commitment may be performed by different authorized users.
- D7: Uncommitted runs expire after 90 days without activity. Partially committed runs never auto-expire. Completed, cancelled, and expired run data follows the existing historical retention policy; audit events remain independently durable.
- D8: The target must be the immediately next configured school year. Only students in the highest active grade may use GRADUATE, which is their default recommendation. Other students recommend PROMOTE but remain NEEDS_ACTION until assigned a valid next-grade target class.
- D9: Bulk decision updates apply to the complete server-resolved filtered scope, not only loaded pages. They require the expected run version and return affected and rejected counts with stable row-level reasons.

## Requirements

### Functional Requirements

#### Run Lifecycle

- FR-1: The backend must create or resume a campus-scoped lifecycle run identified by a stable lifecycleRunId.
- FR-2: Creating a run for a campus/source-year combination that already has an active run must return the existing run identity or a stable ACTIVE_RUN_EXISTS conflict; it must not create a competing run.
- FR-3: Source and target school years must exist in the selected campus, be different, and be chronologically adjacent with the target as the immediately next configured school year.
- FR-4: sourceClosureDate and targetEnrollmentDate must be strict date-only values within their respective school-year bounds.
- FR-5: Before the first successful row commit, an authorized user may edit the target year and lifecycle dates. An edit must increment the run version, recalculate affected readiness, and invalidate all current previews.
- FR-6: Before the first successful row commit, an authorized user may cancel the run. A cancelled run is read-only and no longer blocks creation of a replacement run.
- FR-7: After the first successful row commit, target year and lifecycle dates are immutable and cancellation is rejected with a stable status-transition code.
- FR-8: Run responses must expose source/target year display data, lifecycle dates, status, version, aggregate totals, grade/class progress, created/updated/completed timestamps, actor metadata where permitted, current previews, and last committed scope.
- FR-9: Run status must distinguish at least SETUP_INCOMPLETE, DRAFT, IN_PROGRESS, PARTIALLY_COMMITTED, NEEDS_RECONCILIATION, COMPLETED, CANCELLED, and EXPIRED.

#### Candidate Membership and Decisions

- FR-10: Run creation must snapshot all eligible open SchoolYearEnrollment rows for the selected campus/source year without mutating enrollment or attendance records.
- FR-11: Each run candidate must be anchored to its sourceSchoolYearEnrollmentId and retain source grade/class context sufficient to detect later movement or ineligibility.
- FR-12: Candidate refresh must add newly eligible registrations as NOT_STARTED without overwriting existing decisions.
- FR-13: Candidate refresh must move a changed candidate to its current source grade/class, preserve a compatible decision, clear an incompatible target-class assignment, and set NEEDS_REVIEW.
- FR-14: Candidate refresh must retain withdrawn, externally completed, or otherwise ineligible rows as NO_LONGER_ELIGIBLE and exclude them from remaining-work denominators.
- FR-15: The backend must return authoritative campus, grade, and class counts for eligible, not started, needs action, ready, previewed, skipped, committed, already applied, conflict, failed, needs review, and no longer eligible rows.
- FR-16: Candidate listing must support bounded offset pagination, search by current or snapshot student name/code, filtering by source grade, source class, and workflow status, and stable server-side sorting.
- FR-17: Candidate list items must expose student identity/display data, source SchoolYearEnrollment and active class context, recommended outcome, saved outcome, target class, decision/preview/commit status, stable conflict codes, row version/update metadata, and applicable operations/messages.
- FR-18: PROMOTE and RETAIN decisions require an existing target class in the selected campus and target school year. PROMOTE requires the immediately next grade order; RETAIN requires the same grade.
- FR-19: GRADUATE is valid only for the highest non-archived grade in the campus. Highest-grade candidates default to GRADUATE; other candidates default to a PROMOTE recommendation but remain NEEDS_ACTION until a target class is assigned.
- FR-20: SKIP requires no target class and performs no enrollment mutation.
- FR-21: Authorized users must be able to save one or more decisions in a bounded request using expectedVersion. The response must include accepted/rejected rows, updated scope counts, and the new run version.
- FR-22: Bulk decisions must resolve the complete declared server-side scope, including unloaded pages, against expectedVersion. The response must include the resolved scope identity, affected count, rejected count, stable rejection reasons, and the new run version.
- FR-23: A stale expectedVersion must return HTTP 409 with a stable STALE_RUN_VERSION code and enough current run/row state for the frontend to recover without silent overwrite.

#### Scoped Preview

- FR-24: An authorized user must be able to preview a whole grade, one or more source classes within one grade, or an explicit student subset belonging to the run.
- FR-25: Preview must read the persisted decisions for the resolved scope, materialize the exact normalized candidate row set, and remain non-mutating for SchoolYearEnrollment, Enrollment, and attendance data.
- FR-26: Preview must return previewRunId, digest, lifecycleRunId, run version, scope identity, expiry, summary counts, row-level READY/SKIPPED/CONFLICT status, stable conflict codes, proposed operations, and source/target context.
- FR-27: Preview must reject unresolved NEEDS_ACTION or NEEDS_REVIEW rows and invalid cross-campus, cross-grade, duplicate, or ineligible explicit scope members with stable codes.
- FR-28: A preview must enforce a server-configured maximum scope size, initially compatible with the existing 500-row maximum. An oversized scope returns SCOPE_TOO_LARGE plus maximum size, class counts, and suggested smaller scopes.
- FR-29: If one source class exceeds the maximum, the backend must expose deterministic, non-overlapping student batches using stable ordering and identities. Each batch is previewed and committed separately.
- FR-30: Current previews may coexist only when their materialized candidate sets do not overlap.
- FR-31: Creating a preview whose candidate set overlaps an existing current preview must mark the older preview SUPERSEDED.
- FR-32: A decision or candidate-context change must invalidate current previews containing the affected rows. A setup change must invalidate every current preview for the run.
- FR-33: An otherwise-current preview expires 24 hours after creation and must be re-created before commit.

#### Commit, Results, and Completion

- FR-34: Commit must accept only previewRunId and digest, resolve the associated run/scope, verify permission and preview status, and apply only the exact materialized rows reviewed in that preview.
- FR-35: Commit must reject expired, invalidated, superseded, digest-mismatched, or already-finalized previews with stable request-level codes.
- FR-36: Commit must preserve global preflight plus independent per-student transactions and revalidate current database state before each row mutation.
- FR-37: Commit must return and persist row-level SUCCESS, FAILED, SKIPPED, and ALREADY_APPLIED results with stable codes, messages, operations, and resulting record identifiers.
- FR-38: A commit retry must not duplicate source closures, target SchoolYearEnrollment rows, target Enrollment rows, audit events representing successful mutations, or attendance data.
- FR-39: Commit attempts and their full row results must be retrievable after refresh or a later session.
- FR-40: A successful commit must update candidate status and authoritative class, grade, and school progress in the same logical operation or make refreshed progress immediately observable.
- FR-41: SUCCESS, ALREADY_APPLIED, and reviewed SKIP count as complete. NO_LONGER_ELIGIBLE is excluded. FAILED, CONFLICT, NEEDS_ACTION, and NEEDS_REVIEW remain incomplete.
- FR-42: A run reaches COMPLETED only when every included candidate is complete under FR-41.
- FR-43: A run with successful commits plus unresolved failed/conflict rows must report PARTIALLY_COMMITTED or NEEDS_RECONCILIATION and allow retries of unresolved rows.
- FR-44: Successfully committed candidate rows and finalized commit results are immutable inside Lifecycle. Correction or reversal must use existing enrollment/correction workflows outside this feature.
- FR-45: Preview, commit, retry, refresh, expiration, and reconciliation paths must never create, update, delete, migrate, or recalculate attendance records.

#### Authorization, Audit, Retention, and Compatibility

- FR-46: Read endpoints require school_year_lifecycle.read; setup/refresh/decision mutations require school_year_lifecycle.manage; preview requires school_year_lifecycle.preview; commit requires school_year_lifecycle.commit.
- FR-47: A user with read/commit permission may commit a valid preview created by another user without receiving implicit manage/preview permission.
- FR-48: Every route must enforce authentication, campus access, and resource-level campus ownership in addition to explicit lifecycle permissions.
- FR-49: Audit events must capture run creation/setup changes/cancellation/expiration, candidate refresh summaries, decision/bulk changes, preview creation/invalidation/supersession, commit batch context, and successful row mutations with actor, campus, run, scope, version, preview, digest, and result context as applicable.
- FR-50: Uncommitted runs must become EXPIRED after 90 days without activity and release the active-run uniqueness constraint.
- FR-51: A run with at least one successful row commit must not auto-expire.
- FR-52: Completed, cancelled, and expired runs, decisions, previews, and result records must be retained or disposed according to the existing historical retention policy; audit records follow their independent retention guarantees.
- FR-53: Existing POST /school-year-lifecycle/preview and POST /school-year-lifecycle/commit clients must remain compatible during migration or receive an explicitly documented versioned migration path. The unsafe empty-rows-means-unbounded behavior must not be carried into new run-scoped APIs.
- FR-54: All request-level and row-level errors required by the frontend must use stable documented machine-readable codes.

### Non-Functional Requirements

- NFR-1: The feature must operate correctly with a seeded campus containing at least 2,000 source-year candidates, including a grade and an individual class larger than the configured preview limit.
- NFR-2: Candidate and progress reads must use bounded queries and must not load the full campus candidate population to return one page.
- NFR-3: Candidate refresh, progress aggregation, and preview planning must batch related enrollment/class lookups; database query counts must not grow linearly through per-candidate lookup loops.
- NFR-4: Candidate ordering and deterministic batch membership must be stable across repeated reads for the same run version.
- NFR-5: All mutations must be campus-isolated, permission-protected, auditable, and safe under concurrent requests.
- NFR-6: Optimistic version conflicts must fail atomically without partially applying draft/bulk changes.
- NFR-7: Commit remains partial-success at the row level while each successful student's lifecycle mutations and audit event remain atomic.
- NFR-8: Date-only semantics must use the existing strict parser/storage conventions and must not shift dates across time zones.
- NFR-9: New persistence must include indexes supporting active-run lookup, run/version access, candidate grade/class/status paging, preview scope lookup, expiration, and result retrieval.
- NFR-10: Existing enrollment, school-year history, historical snapshot, audit, and correction behavior must remain backward compatible.
- NFR-11: OpenAPI/DTO documentation must define pagination, scope expressions, statuses, conflict codes, permissions, version behavior, expiry, retention, and maximum scope behavior.
- NFR-12: Logs and error responses must not expose cross-campus resource existence or sensitive decision data beyond the caller's permissions.

## Acceptance Criteria

- [ ] AC-1: Creating a valid run snapshots eligible candidates and returns a resumable lifecycleRunId, version, totals, and grade/class progress without enrollment or attendance writes.
- [ ] AC-2: A second active run for the same campus/source year is not created, including when it proposes a different target year.
- [ ] AC-3: A non-adjacent, identical, cross-campus, or missing source/target school year is rejected with a stable code.
- [ ] AC-4: Setup edits and cancellation work before the first successful commit; setup edits invalidate previews. Both operations are rejected afterward.
- [ ] AC-5: Refresh adds new candidates, relocates changed candidates with NEEDS_REVIEW behavior, and retains ineligible candidates as NO_LONGER_ELIGIBLE.
- [ ] AC-6: Candidate pages support the documented pagination, search, grade/class/status filters, stable sorting, and full-scope counts.
- [ ] AC-7: Candidate items expose all source context, saved decisions, recommendations, statuses, conflict codes, and concurrency metadata needed by the frontend.
- [ ] AC-8: Highest-grade candidates default to GRADUATE; non-final candidates without target classes remain NEEDS_ACTION and cannot be committed as graduates.
- [ ] AC-9: Individual and bulk decision saves reject stale versions with HTTP 409 and do not silently overwrite concurrent work.
- [ ] AC-10: Bulk decisions apply to all current server-resolved filter matches, including unloaded pages, and return affected/rejected counts.
- [ ] AC-11: Grade, class-group, and explicit-student previews materialize only their declared rows and preserve the existing non-mutating digest/token safety model.
- [ ] AC-12: Oversized scopes return SCOPE_TOO_LARGE guidance; an oversized class can be completed through deterministic, non-overlapping, separately reviewed batches.
- [ ] AC-13: Non-overlapping previews coexist, overlapping previews supersede older ones, setup changes invalidate all previews, affected decision/source changes invalidate relevant previews, and previews expire after 24 hours.
- [ ] AC-14: Commit applies only the exact reviewed preview rows and returns persisted row-level SUCCESS, FAILED, SKIPPED, and ALREADY_APPLIED results.
- [ ] AC-15: Partial commit and retry do not duplicate target/source records or successful mutations and leave unresolved rows available for reconciliation.
- [ ] AC-16: Commit results and updated grade/class/school progress can be reloaded after refresh or a later session.
- [ ] AC-17: Completion counts treat SUCCESS, ALREADY_APPLIED, and reviewed SKIP as complete, exclude NO_LONGER_ELIGIBLE, and keep unresolved rows incomplete.
- [ ] AC-18: Successfully committed rows cannot be reopened or reversed through Lifecycle.
- [ ] AC-19: A preview preparer without commit permission cannot commit, while a separate authorized committer can commit the preparer's valid preview.
- [ ] AC-20: Each route enforces the correct read/manage/preview/commit permission and hides cross-campus resources consistently.
- [ ] AC-21: Uncommitted runs expire after 90 inactive days; partially committed runs do not auto-expire; retained records follow the historical retention policy.
- [ ] AC-22: Audit records capture the required run, scope, version, preview, digest, actor, and result context.
- [ ] AC-23: Automated verification uses more than 500 and at least 2,000 candidates, including a partially committed grade, oversized class, refresh changes, stale concurrent write, and result reload.
- [ ] AC-24: Preview, commit, retry, refresh, cancellation, expiration, and reconciliation tests demonstrate no attendance reads or writes outside existing enrollment relations.
- [ ] AC-25: Existing lifecycle preview/commit contracts remain usable during the documented migration period and the new APIs never interpret an empty explicit row list as an unbounded whole-school request.

## Scenarios

### Scenario 1: Create and Resume a Run

**Given** an authorized administrator, a source year, and its immediately next target year
**When** the administrator creates a lifecycle run and later reopens it
**Then** the same run identity, saved decisions, current progress, and retained results are returned.

### Scenario 2: Prevent Competing Runs

**Given** an active run for a campus/source year
**When** another user attempts to create a run for the same source year
**Then** no competing run is created and the response identifies the existing active run or returns ACTIVE_RUN_EXISTS.

### Scenario 3: Refresh Changed Candidates

**Given** a run containing saved decisions
**When** a new registration appears, one student moves class/grade, and another becomes ineligible
**Then** the new row is added, the moved row is relocated and marked for review with incompatible assignment cleared, and the ineligible row remains historically visible but excluded from remaining counts.

### Scenario 4: Bulk Update Across Pages

**Given** a filtered grade/class scope spanning multiple candidate pages
**When** an administrator applies a bulk target-class decision with the current run version
**Then** all matching rows are resolved server-side and the response returns affected/rejected counts and a new version.

### Scenario 5: Oversized Grade and Class

**Given** a grade larger than the preview maximum and one class that also exceeds the maximum
**When** the administrator requests preview guidance
**Then** the backend returns class counts and deterministic class/student subscopes that can each be separately previewed and committed without overlap.

### Scenario 6: Concurrent Editors

**Given** two administrators reading the same run version
**When** the first saves a decision and the second submits a stale decision
**Then** the second request returns HTTP 409 with current state and applies no changes.

### Scenario 7: Parallel Non-Overlapping Previews

**Given** ready decisions in two different grade/class scopes
**When** two authorized users preview the non-overlapping scopes
**Then** both previews remain current; a later overlapping preview supersedes only the older overlapping preview.

### Scenario 8: Commit and Retry Partial Results

**Given** a valid reviewed preview whose rows change before commit
**When** commit succeeds for some rows and fails for others
**Then** successful rows remain applied atomically, failed rows remain reconcilable, the result is persisted, and retry reports already-applied rows without duplicates.

### Scenario 9: Separation of Duties

**Given** one user with read/manage/preview and another with read/commit
**When** the first prepares a valid preview and the second commits it
**Then** the commit succeeds without granting either user implicit additional permissions.

### Scenario 10: Run and Preview Expiration

**Given** an uncommitted inactive run and an otherwise-current preview
**When** the preview reaches 24 hours or the run reaches 90 inactive days
**Then** the preview/run becomes unusable for mutation with stable expiry codes, while partially committed runs remain available.

### Scenario 11: Completion and Correction Boundary

**Given** a run containing successful, already-applied, skipped, failed, and no-longer-eligible rows
**When** progress is calculated
**Then** only failed/unresolved rows prevent completion, and a successful row cannot be reopened through Lifecycle.

### Scenario 12: Attendance Isolation

**Given** any lifecycle preview, commit, retry, refresh, cancellation, or expiration path
**When** it executes
**Then** no attendance record is created, updated, deleted, migrated, or recalculated.

## Technical Notes

- Introduce a dedicated lifecycle run aggregate and persisted candidate/decision state. Keep SchoolYearLifecyclePreviewRun as an immutable reviewed artifact linked to a run instead of overloading it as mutable draft state.
- Reuse the existing normalized preview payload, digest, planner operations, per-student commit transactions, retry classification, campus guards, audit recorder, strict date parser, and historical snapshot builders.
- GradeLevel IDs are campus-scoped and stable across school years. Class IDs are school-year-specific; source class comes from the candidate's active Enrollment and target class must belong to the target year.
- Candidate/progress queries may reuse StandardRequest pagination conventions, but lifecycle status joins and aggregates should remain in lifecycle-specific repository ports/adapters.
- Replace sequential per-candidate target-registration lookup during planning with batched repository reads.
- Persist commit results in queryable lifecycle-owned state; generic audit events are not a substitute for the frontend result API.
- Use database-enforced active-run uniqueness and indexes appropriate to PostgreSQL/Prisma migration conventions.
- Correct the existing behavior that treats every missing target class as GRADUATE and the existing empty-row preview path that can expand without an explicit bound.
- Keep detailed execution breakdown in Knowns Tasks rather than this spec.

## Task Links

- @task-t43o5o [school-year-lifecycle-redesign-backend-01] Lifecycle run persistence and setup invariants
- @task-shbgw9 [school-year-lifecycle-redesign-backend-02] Run lifecycle APIs and initial candidate snapshot
- @task-5yc9bc [school-year-lifecycle-redesign-backend-03] Candidate refresh, paging, and progress projections
- @task-07tyfs [school-year-lifecycle-redesign-backend-04] Draft decisions, bulk scopes, and optimistic concurrency
- @task-hrnitu [school-year-lifecycle-redesign-backend-05] Scoped preview and deterministic batching
- @task-1tfq50 [school-year-lifecycle-redesign-backend-06] Run-scoped commit, persisted results, and completion
- @task-p616wh [school-year-lifecycle-redesign-backend-07] Lifecycle authorization, audit, expiry, and retention
- @task-1mr1sj [school-year-lifecycle-redesign-backend-08] Scale, compatibility, and end-to-end verification

## Open Questions

None.
