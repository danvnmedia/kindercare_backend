---
title: Historical Snapshot Retention Backend Companion
description: Backend companion specification for compliance-grade snapshots, retention, archive, and correction behavior.
createdAt: '2026-07-07T20:48:09.103Z'
updatedAt: '2026-07-07T22:59:02.469Z'
tags:
  - spec approved
---

## Overview

Backend companion for the frontend `Historical Snapshot Retention` spec. Define the compliance-grade target for historical snapshots, immutable/finalized records, correction/audit behavior, retention state, archive/redaction/deletion rules, permissions, and export support.

This spec defines a broad target but permits phased implementation. Attendance implementation is excluded and will be handled in a later dedicated Attendance Historical Context spec.

Frontend companion: frontend project doc `specs/2026-07-07/historical-snapshot-retention`.

## Locked Decisions

- D1: Backend companion specs mirror frontend spec boundaries and are created only where backend/API/data changes are required.
- D4: Historical views and reports use point-in-time snapshots where available, while retaining links to current records.
- D6: Historical Snapshot / Retention targets compliance-grade archive behavior, with phased implementation.
- D7: Backend companion specs are created now for every spec with backend impact, including the compliance archive target.
- D9: Attendance implementation is excluded and mentioned only as a future integration point.
- D10: Retention periods are configurable per deployment, campus, or environment; destructive historical actions are blocked until a configured policy exists.
- D11: Phase-one mandatory snapshots are student `fullName`, `studentCode`, `nickname`; class `name`; grade level `name`, `order`; and school year `name`, `startDate`, `endDate`. Guardian and staff snapshots are not mandatory in phase one.
- D12: Corrections append correction events and expose an effective corrected view; original finalized records are not mutated, and full superseding enrollment rows are out of phase one.
- D13: Historical record export requires an explicit high-trust permission such as `historical_records.export`; ordinary in-app history view permission does not imply export permission.
- D14: Student hard delete is blocked while retained historical records exist; anonymization/redaction is allowed only through the retention workflow when policy says the records are eligible.

## Requirements

### Functional Requirements

- FR-1: Define snapshot fields for historical school records, beginning with enrollment/class roster contexts.
- FR-2: Preserve point-in-time labels for student, class, grade, and school year in phase one.
- FR-3: Phase-one snapshots must include student `fullName`, `studentCode`, `nickname`; class `name`; grade level `name`, `order`; and school year `name`, `startDate`, `endDate`.
- FR-4: Return both snapshot display fields and current record IDs so frontend can show historical truth while linking to live profiles.
- FR-5: Mark legacy rows with explicit snapshot availability/fallback metadata.
- FR-6: Define finalized/immutable state for historical records that should not be directly edited.
- FR-7: Provide correction behavior that appends correction events with actor, timestamp, reason, before/after values, and relationship to the original historical record.
- FR-8: Historical read APIs must expose an effective corrected view without mutating original finalized records.
- FR-9: Define retention metadata and APIs for archive status, retention expiry, redaction status, deletion eligibility, legal hold where applicable, and policy source.
- FR-10: Enforce permission boundaries for viewing, correcting, exporting, archiving, redacting, and deleting historical records.
- FR-11: Require explicit `historical_records.export`-style permission for historical exports.
- FR-12: Block destructive historical delete/redaction/anonymization actions until a retention policy is configured for the deployment/campus/environment.
- FR-13: Block student hard delete while retained historical records exist.
- FR-14: Allow anonymization/redaction only through the retention workflow after policy eligibility is satisfied.
- FR-15: Provide export-ready DTOs for historical records with snapshot values, effective correction values, and audit metadata where permitted.
- FR-16: Keep the snapshot model extensible for later attendance history without implementing attendance in this spec.

### Non-Functional Requirements

- NFR-1: Historical record APIs must not silently substitute current data without fallback metadata.
- NFR-2: Correction, export, redaction, anonymization, and destructive-action attempts must be auditable.
- NFR-3: Retention behavior must be deterministic and test-covered before any destructive deletion/anonymization is enabled.
- NFR-4: Snapshot storage must be designed for long-lived records and migration from legacy rows.
- NFR-5: Phased rollout must allow existing historical views to work before every domain is snapshot-enabled.
- NFR-6: Retention policy configuration must be explicit and observable so blocked destructive actions can explain what policy is missing.

## Acceptance Criteria

- [ ] AC-1: Backend DTOs for historical enrollment/class records include phase-one snapshot fields where available.
- [ ] AC-2: Backend DTOs indicate when snapshot data is missing and current fallback data is being used.
- [ ] AC-3: Backend stores or can produce point-in-time labels for phase-one historical roster/report fields.
- [ ] AC-4: Finalized historical records cannot be directly mutated through ordinary update endpoints.
- [ ] AC-5: Correction operations require a reason and append correction audit metadata.
- [ ] AC-6: Historical reads can return an effective corrected view while preserving the original finalized record.
- [ ] AC-7: Permission checks guard historical correction, export, archive, redaction, and deletion endpoints.
- [ ] AC-8: Export requires an explicit high-trust historical export permission.
- [ ] AC-9: Retention/archive/redaction states and policy source are represented in backend data contracts.
- [ ] AC-10: Destructive historical actions are blocked when no retention policy is configured.
- [ ] AC-11: Student hard delete is blocked while retained historical records exist.
- [ ] AC-12: Anonymization/redaction is only available through the retention workflow after policy eligibility is satisfied.
- [ ] AC-13: Legacy records can be returned with fallback metadata without migration failure.
- [ ] AC-14: Attendance snapshot/retention implementation is not included in this spec.

## Scenarios

### Scenario 1: Snapshot Roster Row

**Given** an enrollment row has stored phase-one snapshot labels
**When** a historical roster API returns it
**Then** the response includes the snapshot labels and current linked IDs.

### Scenario 2: Legacy Fallback Row

**Given** an older enrollment row lacks snapshots
**When** a historical API returns the row
**Then** it includes fallback metadata and current display data if available.

### Scenario 3: Finalized Record Correction

**Given** a finalized historical record contains an incorrect label
**When** an authorized user submits a correction with a reason
**Then** the backend appends a correction event and exposes the corrected effective view without mutating the original record.

### Scenario 4: Restricted Export

**Given** a user lacks `historical_records.export` or equivalent export permission
**When** they call a historical export endpoint
**Then** the backend rejects access using existing authorization conventions.

### Scenario 5: Missing Retention Policy

**Given** no retention policy is configured for the deployment/campus/environment
**When** an authorized user attempts destructive historical deletion, redaction, or anonymization
**Then** the backend blocks the action and reports that retention policy configuration is required.

### Scenario 6: Student Hard Delete With Retained History

**Given** a student has retained historical records
**When** a hard-delete path attempts to delete the student
**Then** the backend blocks hard delete and directs the caller to the retention workflow.

### Scenario 7: Policy-Eligible Redaction

**Given** retained historical records are eligible for anonymization/redaction under the configured policy
**When** an authorized user performs the retention workflow
**Then** the backend redacts or anonymizes according to policy and records audit metadata.

## Technical Notes

- Phase one can focus on enrollment, school-year enrollment, class roster, and student/class history data.
- Later attendance history should reuse the snapshot/retention primitives but is explicitly out of scope here.
- Evaluate whether snapshots live as JSON blobs, typed columns, companion tables, or audit/event records before implementation planning.
- Corrections should be append-only events in phase one, with query logic producing an effective corrected view.
- Retention policy configuration should be read by destructive-action guards before any hard delete, redaction, or anonymization proceeds.
- Existing audit infrastructure should be reused where possible, but additional audit actions and RBAC permissions are likely required.

## Task Links

- @task-sy40xe [historical-snapshot-retention-backend-companion-01] Snapshot storage and capture model
- @task-84n1mt [historical-snapshot-retention-backend-companion-02] Historical read DTOs and fallback behavior
- @task-32iaqb [historical-snapshot-retention-backend-companion-03] Correction events and effective historical view
- @task-hnth5z [historical-snapshot-retention-backend-companion-04] Retention policy and state contracts
- @task-vg3tz3 [historical-snapshot-retention-backend-companion-05] Historical export permission and DTOs
- @task-t33ll5 [historical-snapshot-retention-backend-companion-06] Hard-delete block and retention redaction workflow

## Open Questions

None. Retention clarification pass resolved the previous legal period, phase-one snapshot fields, correction model, export permission, and hard-delete behavior questions.
