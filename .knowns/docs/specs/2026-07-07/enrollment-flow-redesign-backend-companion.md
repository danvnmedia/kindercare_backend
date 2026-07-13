---
title: Enrollment Flow Redesign Backend Companion
description: Backend companion specification for enrollment API contract and readiness support.
createdAt: '2026-07-07T20:47:47.552Z'
updatedAt: '2026-07-07T22:21:31.409Z'
tags:
  - spec approved
---

## Overview

Backend companion for the frontend `Enrollment Flow Redesign` spec. Define API and DTO changes needed to support a redesigned school-year registration and class enrollment experience, while fixing known contract and lifecycle issues.

Attendance implementation is excluded. Attendance historical context will be handled in a later dedicated spec.

Frontend companion: frontend project doc `specs/2026-07-07/enrollment-flow-redesign`.

## Locked Decisions

- D1: Backend companion specs mirror frontend spec boundaries and are created only where backend/API/data changes are required.
- D5: Enrollment Flow Stabilization includes a full frontend redesign of the class enrollment and school-year registration experience, while also fixing known correctness bugs.
- D9: Attendance implementation is excluded and mentioned only as a future integration point.
- D10: `enrollmentDate` is the only canonical class enrollment date field; do not add or preserve a `startDate` compatibility alias.
- D11: School-year enrollment grade corrections are allowed only while no class enrollment exists under that school-year registration; after class enrollment exists, grade changes require a separate lifecycle/correction workflow.
- D12: Add `COMPLETED` as a public student phase distinct from `WAITING`.
- D13: Add a dedicated read-only enrollment readiness/preview endpoint so the frontend does not infer critical eligibility rules from eligible-students lists or failed writes.

## Requirements

### Functional Requirements

- FR-1: Align class enrollment response DTOs with frontend semantics by using `enrollmentDate` consistently as the canonical date field.
- FR-2: Remove the need for `startDate` compatibility in enrollment responses; development clients must use `enrollmentDate`.
- FR-3: Provide typed error details for enrollment readiness failures: no school-year registration, grade mismatch, already actively enrolled, duplicate same-day enrollment, date outside school year, parent closed, invalid transfer date, and cross-campus/not-found.
- FR-4: Provide a dedicated read-only enrollment readiness/preview endpoint that returns typed row states before write attempts.
- FR-5: Ensure single and bulk class enrollment endpoints return enough row-level detail for redesigned readiness and recovery UI.
- FR-6: Ensure transfer endpoints return enough source and target class context for redesigned transfer UI.
- FR-7: Provide backend support for school-year enrollment grade correction only when no class enrollment exists under the parent registration.
- FR-8: Reject or route grade corrections through a separate lifecycle/correction workflow once class enrollment exists under the parent registration.
- FR-9: Add `COMPLETED` to the public student phase projection and DTO contract.
- FR-10: Keep all enrollment, transfer, withdrawal, and school-year registration dates as date-only values.
- FR-11: Ensure date validation uses class school-year bounds and parent school-year registration bounds consistently.
- FR-12: Maintain campus scoping and typed conflict behavior across all enrollment endpoints.

### Non-Functional Requirements

- NFR-1: DTO changes must be documented and covered by controller/use-case tests.
- NFR-2: Row-level bulk and readiness responses must remain stable for frontend mapping and localization.
- NFR-3: No endpoint should require the frontend to infer critical eligibility rules from generic error messages.
- NFR-4: Removing `startDate` compatibility is acceptable because the product is still in development; tests should enforce the clean contract.
- NFR-5: Date-only behavior must be explicit in validation and serialization tests, not only implied by database column types.

## Acceptance Criteria

- [ ] AC-1: Class enrollment responses expose `enrollmentDate` and do not expose a `startDate` alias.
- [ ] AC-2: Bulk enrollment row results include stable typed reasons and context for missing school-year registration and grade mismatch.
- [ ] AC-3: Bulk transfer row results include stable typed reasons and context for invalid source/target/date conditions.
- [ ] AC-4: The dedicated readiness endpoint returns typed row states before class enrollment writes.
- [ ] AC-5: Backend rejects out-of-school-year enrollment dates before writing.
- [ ] AC-6: Backend accepts and normalizes date-only strings for enrollment-related requests.
- [ ] AC-7: `COMPLETED` is present in public student phase types, projection, API response DTOs, and tests.
- [ ] AC-8: Grade mismatch recovery backend support allows grade correction only when no class enrollment exists under the school-year registration.
- [ ] AC-9: Grade correction after class enrollment exists is rejected or routed to a future correction/lifecycle workflow with a stable frontend-facing error/action contract.
- [ ] AC-10: Existing campus access patterns remain protected across readiness and mutation endpoints.
- [ ] AC-11: Attendance records are not returned or modified as part of these changes.

## Scenarios

### Scenario 1: Class Roster Date Contract

**Given** a class enrollment exists
**When** the roster endpoint returns it
**Then** the response includes `enrollmentDate` and does not require frontend guessing or `startDate` fallback.

### Scenario 2: Missing School-Year Registration

**Given** a student has no open target-year registration
**When** readiness or bulk enrollment runs
**Then** the row returns `NO_SCHOOL_YEAR_ENROLLMENT` with target school-year context.

### Scenario 3: Grade Mismatch

**Given** a student's target-year registration grade differs from the class grade
**When** readiness or enrollment is attempted
**Then** the backend returns `GRADE_LEVEL_MISMATCH` with enough context for the frontend to explain or offer allowed correction.

### Scenario 4: Grade Correction Before Class Enrollment

**Given** a school-year registration has no child class enrollment
**When** an authorized correction request changes its grade level to another valid campus grade
**Then** the backend updates the grade and returns the corrected school-year enrollment.

### Scenario 5: Grade Correction After Class Enrollment

**Given** a school-year registration already has at least one child class enrollment
**When** an authorized correction request attempts to change its grade level
**Then** the backend rejects the request with a stable correction-not-allowed code.

### Scenario 6: Completed Student Phase

**Given** a school-year enrollment is closed with `COMPLETED`
**When** the student phase projection is queried
**Then** the returned public phase is `COMPLETED`, not `WAITING`.

### Scenario 7: Date-Only Request

**Given** a frontend sends an enrollment date as `yyyy-MM-dd`
**When** the backend validates the request
**Then** validation uses date-only semantics and school-year bounds.

## Technical Notes

- Current backend enrollment responses expose `enrollmentDate`; this spec confirms it as the clean contract and rejects adding `startDate` compatibility.
- Current `StudentPhase` and `student_with_phase` view must change so `COMPLETED` no longer falls through to `WAITING`.
- Existing bulk enrollment and transfer use cases already provide several typed skip codes; this spec extends their payload detail and adds a read-only readiness path.
- Grade correction likely belongs near school-year enrollment use cases and must count child class enrollments before allowing changes.
- This spec should not implement attendance context or attendance history.

## Task Links

- @task/dlgiy4 - [enrollment-flow-redesign-backend-companion-01] Enrollment date contract and date-only validation cleanup (fulfills AC-1, AC-5, AC-6, AC-11)
- @task/tquh36 - [enrollment-flow-redesign-backend-companion-02] Public COMPLETED student phase support (fulfills AC-7)
- @task/y99wkj - [enrollment-flow-redesign-backend-companion-03] Read-only enrollment readiness endpoint (fulfills AC-4, AC-5, AC-10, AC-11)
- @task/2opem0 - [enrollment-flow-redesign-backend-companion-04] Bulk enrollment and transfer row-result context (fulfills AC-2, AC-3, AC-5, AC-10, AC-11)
- @task/1wo72x - [enrollment-flow-redesign-backend-companion-05] School-year enrollment grade correction workflow (fulfills AC-8, AC-9, AC-10, AC-11)

## Open Questions

None. Enrollment clarification pass resolved the date field, grade correction, `COMPLETED` phase, and readiness endpoint questions.
