---
title: School Year Student History Views Backend Companion
description: Backend companion specification for school-year-scoped student and historical roster APIs.
createdAt: '2026-07-07T20:47:25.574Z'
updatedAt: '2026-07-08T01:38:29.163Z'
tags:
  - spec approved
---

## Overview

Backend companion for the frontend `School Year Student History Views` spec. Define query APIs and DTOs for school-year-scoped student lists, old class rosters, student class-enrollment history, snapshot labels, fallback markers, and active versus historical counts.

Attendance implementation is excluded. Attendance historical context will be handled in a later dedicated spec.

Frontend companion: frontend project doc `specs/2026-07-07/school-year-student-history-views`.

## Locked Decisions

- D1: Backend companion specs mirror frontend spec boundaries and are created only where backend/API/data changes are required.
- D4: Historical views and reports use point-in-time snapshots where available, while retaining links to current records.
- D9: Attendance implementation is excluded and mentioned only as a future integration point.
- D10: Year-scoped student lists are exposed as `GET /school-years/:schoolYearId/students` with `X-Campus-Id` campus scoping.
- D11: Active and historical roster counts are computed on demand in phase one, not stored or materialized.
- D12: Phase-one history snapshot fields are student `fullName`, `studentCode`, `nickname`; class `name`; grade level `name`, `order`; and school year `name`, `startDate`, `endDate`. Guardian and staff snapshots are out of scope for this history-views phase.
- D13: `completed` and `graduated` are distinct API segment/filter values.

## Requirements

### Functional Requirements

- FR-1: Provide `GET /school-years/:schoolYearId/students` as a campus-scoped API to list students registered for a selected school year.
- FR-2: Support filters or segments for registered, actively class-assigned, unassigned, withdrawn, completed, graduated, and unresolved students.
- FR-3: Return school-year registration context for each row: schoolYearEnrollmentId, schoolYearId, gradeLevelId, enrollmentDate, exitDate, exitReason, and class assignment summary.
- FR-4: Return snapshot labels where available and current-data fallback metadata where snapshots are missing.
- FR-5: For phase one, snapshot-capable DTOs must support student `fullName`, `studentCode`, `nickname`; class `name`; grade level `name`, `order`; and school year `name`, `startDate`, `endDate`.
- FR-6: Provide active and historical roster counts for classes in a school year, computed on demand.
- FR-7: Ensure class roster history endpoints return enrollmentDate, endDate, exitReason, school year, grade, class label, student label, and snapshot/fallback metadata.
- FR-8: Ensure student enrollment history returns all class enrollment periods across school years with enough data for the frontend student history view.
- FR-9: Preserve links to current student/class records via stable IDs while also returning display snapshot fields.
- FR-10: Support pagination, sorting, and search for year-scoped student lists using existing StandardRequest conventions.
- FR-11: Keep campus scoping and cross-campus protection consistent with existing student/class endpoints.
- FR-12: Keep guardian and staff snapshots out of this history-views phase; broader official-record snapshots are handled by the historical snapshot/retention spec.

### Non-Functional Requirements

- NFR-1: Queries must be efficient for campuses with thousands of historical enrollment rows.
- NFR-2: DTO fields must clearly distinguish snapshot display fields from current linked entity fields.
- NFR-3: APIs must avoid changing existing current-state student list behavior unless explicitly versioned or extended.
- NFR-4: Historical count semantics must be documented and stable.
- NFR-5: On-demand active/historical count queries must be covered by tests so semantics do not drift.

## Acceptance Criteria

- [x] AC-1: A frontend can request `GET /school-years/:schoolYearId/students` for one school year without relying on current student phase only.
- [x] AC-2: The year-scoped students API can return unassigned students for a selected school year.
- [x] AC-3: The year-scoped students API can return withdrawn, completed, and graduated students for a selected school year as distinct filter/segment values.
- [x] AC-4: Historical roster DTOs include phase-one snapshot labels when available.
- [x] AC-5: Historical roster DTOs indicate when current data fallback is used.
- [x] AC-6: Class list or class detail APIs expose explicit active and historical roster counts computed on demand.
- [x] AC-7: Student class-enrollment history returns all class periods ordered by enrollment date.
- [x] AC-8: Existing campus access rules are enforced for all new history APIs.
- [x] AC-9: Existing `GET /students` current-state list behavior is not broken by year-scoped history work.
- [x] AC-10: Attendance records are not returned or modified as part of these APIs.

## Scenarios

### Scenario 1: Year-Scoped Registered List

**Given** a selected school year
**When** the frontend requests `GET /school-years/:schoolYearId/students`
**Then** the backend returns school-year enrollment rows with student display context and pagination metadata.

### Scenario 2: Unassigned Segment

**Given** students registered for a year but without open class enrollment in that year
**When** the frontend requests the unassigned segment
**Then** those students are returned with grade and missing-class state.

### Scenario 3: Completed Versus Graduated Segments

**Given** one student has source-year `exitReason=COMPLETED` and another has `exitReason=GRADUATED`
**When** the frontend requests completed and graduated segments separately
**Then** each segment returns only rows matching the requested lifecycle outcome.

### Scenario 4: Historical Roster Snapshot

**Given** a class has historical enrollment rows with snapshot labels
**When** the class roster history API is called
**Then** rows include phase-one snapshot labels and current profile IDs.

### Scenario 5: Legacy Fallback

**Given** a historical row has no snapshot labels
**When** the API returns the row
**Then** it includes current display data plus fallback metadata.

### Scenario 6: Student Class History

**Given** a student has multiple class enrollment periods
**When** the student history endpoint is called
**Then** all periods are returned with school year, class, grade, dates, and exit reason.

## Technical Notes

- Existing `GET /students/:studentId/enrollments` may be reusable but needs frontend-aligned DTO fields and snapshot metadata.
- Existing `GET /classes/:classId/enrollments?includeHistorical=true` may be reusable but must align field names and snapshot/fallback needs.
- Existing `GET /classes` currently exposes only active `studentCount`; this spec should add explicit active/historical count semantics rather than overloading the existing field.
- A new repository/query path is needed for campus + schoolYear `SchoolYearEnrollment` rows with pagination/search/segments.
- The broader snapshot model is defined by `specs/2026-07-07/historical-snapshot-retention-backend-companion`.
- This spec should avoid implementing attendance history.

## Task Links

- @task-uh6isf [school-year-student-history-views-backend-companion-01] Year-scoped student list API
- @task-3np0gk [school-year-student-history-views-backend-companion-02] Historical roster and student history DTO alignment
- @task-le7l93 [school-year-student-history-views-backend-companion-03] Active and historical class roster counts
- @task-9kf75m [school-year-student-history-views-backend-companion-04] Integration and regression coverage

## Open Questions

None. History clarification pass resolved the previous route, count materialization, snapshot field, and completed/graduated segment questions.
