---
title: School Year Lifecycle Backend Companion
description: Backend companion specification for school-year rollover preview and commit APIs.
createdAt: '2026-07-07T20:47:05.208Z'
updatedAt: '2026-07-08T00:01:50.805Z'
tags:
  - spec approved
---

## Overview

Backend companion for the frontend `School Year Lifecycle` spec. Define APIs and data behavior for previewing and committing a full school-year rollover: source-year closure, target-year registration, target class enrollment, graduation, retention, skip handling, and conflict reporting.

Attendance implementation is excluded. Attendance historical context will be handled in a later dedicated spec.

Frontend companion: frontend project doc `specs/2026-07-07/school-year-lifecycle`.

## Locked Decisions

- D1: Backend companion specs mirror frontend spec boundaries and are created only where backend/API/data changes are required.
- D2: The lifecycle feature targets a full promotion workflow, including next-year registration and target class assignment in the same flow.
- D3: Final-year students are handled inside the workflow with default graduate behavior and per-student override for graduate, repeat/retain, or skip.
- D8: Promotion runs as preview then commit, so users can review proposed registrations, graduations, assignments, conflicts, and skips before anything is written.
- D9: Attendance implementation is excluded and mentioned only as a future integration point.
- D10: Commit uses global preflight plus one transaction per student row, allowing partial success with row-level results.
- D11: Preview returns a server-generated `previewRunId` and digest; commit references the preview and still revalidates current database state before writing.
- D12: Promoted or retained continuing students close the source year with `COMPLETED`; final-year graduates close with `GRADUATED`; skipped students remain unchanged.
- D13: Target classes must already exist before commit; commit does not create classes from mapping payloads.

## Requirements

### Functional Requirements

- FR-1: Provide a campus-scoped preview endpoint for school-year lifecycle rollover.
- FR-2: Preview must accept source school year, target school year, effective dates, student outcome overrides, and target class assignments.
- FR-3: Preview must not write enrollment lifecycle data.
- FR-4: Preview must return proposed operations for each student: complete source year, graduate, create target school-year registration, create target class enrollment, retain/repeat, skip, or conflict.
- FR-5: Preview must return a server-generated `previewRunId` and digest that commit can reference.
- FR-6: Provide a campus-scoped commit endpoint that applies an approved preview run.
- FR-7: Commit must run global preflight checks before row processing, then validate each row against current database state again.
- FR-8: Commit must return row-level success, skip, already-applied, and failure results without rolling back independent valid rows.
- FR-9: Commit must create target `SchoolYearEnrollment` rows only when permitted by existing uniqueness and date constraints.
- FR-10: Commit must create target class `Enrollment` rows only when the target class already exists and its school year and grade match the target school-year registration.
- FR-11: Commit must close source-year parent and active class enrollment rows for completed/graduated students using date-only period semantics.
- FR-12: Commit must support final-year outcomes: graduate, repeat/retain, and skip.
- FR-13: Commit must write auditable records for lifecycle changes, including actor, campus, source year, target year, preview run, and per-row outcomes.
- FR-14: The backend must return stable typed conflict codes that the frontend can map to row states.
- FR-15: Commit must not create missing target classes; missing target classes are conflicts.

### Non-Functional Requirements

- NFR-1: Preview must be deterministic for the same input and database state.
- NFR-2: Commit must avoid all-or-nothing failure for row-level conflicts; independent valid rows should still be applied unless a global precondition fails.
- NFR-3: Commit must be safe to retry when the previous attempt partially succeeded, returning already-applied or conflict states instead of creating duplicates.
- NFR-4: All date fields must be date-only values and validated against source/target school-year bounds.
- NFR-5: Cross-campus access must return existing not-found/forbidden behavior consistent with the class-management module.

## Acceptance Criteria

- [ ] AC-1: Preview returns row-level proposed outcomes without creating or updating enrollment lifecycle records.
- [ ] AC-2: Preview reports conflicts for existing target-year registration, missing target class, grade mismatch, invalid date, and missing source registration.
- [ ] AC-3: Preview returns a `previewRunId` and digest usable by commit.
- [ ] AC-4: Commit performs global preflight before row transactions and rejects the whole request only for global precondition failures.
- [ ] AC-5: Commit creates target-year school-year registrations for valid promoted or retained students.
- [ ] AC-6: Commit creates target class enrollments for valid assigned students.
- [ ] AC-7: Commit graduates final-year students when their selected outcome is graduate.
- [ ] AC-8: Commit closes promoted or retained continuing students with `COMPLETED`.
- [ ] AC-9: Commit leaves skipped students unchanged.
- [ ] AC-10: Commit returns row-level success, skipped, already-applied, and failed details.
- [ ] AC-11: Commit writes audit entries for source closure, target registration, target enrollment, graduation outcomes, and preview/commit batch context.
- [ ] AC-12: Date validation rejects source closure dates outside the source school year and target enrollment dates outside the target school year.
- [ ] AC-13: Commit does not create missing target classes.
- [ ] AC-14: Attendance records are not created, updated, or deleted.

## Scenarios

### Scenario 1: Preview Promotion

**Given** a valid source year, target year, and target class assignments
**When** the preview endpoint is called
**Then** the response includes a `previewRunId`, digest, and proposed target registrations/class enrollments without enrollment lifecycle writes.

### Scenario 2: Commit Promotion

**Given** a previously reviewed preview run
**When** the commit endpoint is called
**Then** global preflight runs, valid rows are applied in per-student transactions, and row-level results are returned.

### Scenario 3: Existing Target Registration Conflict

**Given** a student already has an open target-year registration
**When** preview runs
**Then** the row is returned with a conflict code and no duplicate registration operation.

### Scenario 4: Retain Final-Year Student

**Given** a final-year student is marked repeat/retain
**When** commit runs with a valid existing target class
**Then** the source year is closed as `COMPLETED` and a target-year registration/class enrollment is created.

### Scenario 5: Skip Student

**Given** a candidate row is marked skip
**When** commit runs
**Then** no source or target records are changed for that student.

### Scenario 6: Missing Target Class

**Given** a target class mapping references a class that does not exist in the target school year
**When** preview or commit revalidation runs
**Then** the row returns a missing-target-class conflict and no class is created.

## Technical Notes

- Existing `SchoolYearEnrollment`, class `Enrollment`, and lifecycle withdrawal/closure behavior should be reused where possible.
- New endpoints should probably live in class-management near school-year enrollment/lifecycle controllers.
- Commit should use global preflight plus per-student row transactions, matching the partial-success behavior of large batch operations.
- Preview run persistence should store enough payload/digest metadata to detect stale or mismatched commit requests, while commit still revalidates current state.
- Typed conflict/error codes should be stable and documented for frontend mapping.
- This spec should not implement attendance migration or attendance recalculation.

## Task Links

- @task-odw02k [school-year-lifecycle-backend-companion-01] Lifecycle rollover contracts and preview persistence
- @task-83n8fn [school-year-lifecycle-backend-companion-02] Deterministic rollover preview endpoint
- @task-105qqu [school-year-lifecycle-backend-companion-03] Commit preflight, digest validation, and retry semantics
- @task-qnmyta [school-year-lifecycle-backend-companion-04] Commit row lifecycle mutations
- @task-kh023p [school-year-lifecycle-backend-companion-05] Controller, RBAC/audit wiring, and integrated verification

## Open Questions

None. Lifecycle clarification pass resolved the previous transaction, preview freshness, closure reason, and target-class creation questions.
