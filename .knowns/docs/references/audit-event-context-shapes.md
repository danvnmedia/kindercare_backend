---
title: Audit Event Context Shapes
description: Stable context payload contracts for transaction-bound administrative audit events.
createdAt: '2026-07-11T16:27:44.658Z'
updatedAt: '2026-07-11T16:27:44.658Z'
tags:
  - reference
  - audit
  - api-contract
---

# Audit Event Context Shapes

This reference documents stable `AuditEventRecorderPort` context payloads used by audited backend mutations. Context fields are additive unless a feature specification explicitly declares a breaking change.

## CANCEL_SCHOOL_YEAR_ENROLLMENT

Emitted exactly once for the first successful cancellation of an upcoming school-year enrollment. The event is recorded inside the same transaction as parent cancellation, applicable child cancellation, historical finalization, and School Year Lifecycle reconciliation. An idempotent replay emits no event.

- `actorName: string | null` — display-name snapshot for the authenticated actor.
- `studentId: string` — student owning the registration.
- `schoolYearEnrollmentId: string` — cancelled parent enrollment ID.
- `schoolYearId: string` — school year owning the parent.
- `scheduledEnrollmentDate: string` — original parent start date as an ISO timestamp.
- `cancellationReason: FAMILY_REQUEST | CHANGED_SCHOOL | DUPLICATE_REGISTRATION | DATA_ENTRY_ERROR | OTHER`.
- `cancellationNote: string | null` — trimmed optional note, at most 500 characters.
- `affectedChildIds: string[]` — upcoming child placements cancelled with the parent.
- `affectedChildCount: number` — length of `affectedChildIds`.
- `lifecycle.noLongerEligibleCandidateIds: string[]` — uncommitted Lifecycle candidates made ineligible.
- `lifecycle.invalidatedPreviewIds: string[]` — uncommitted Lifecycle previews invalidated by cancellation.
- `beforeStatus: UPCOMING`.
- `afterStatus: CANCELLED`.

The surrounding audit event uses `action: CANCEL_SCHOOL_YEAR_ENROLLMENT`, `targetType: student`, `targetId` equal to `studentId`, and the selected `campusId`. Its before/after values include effective status and cancellation time.
