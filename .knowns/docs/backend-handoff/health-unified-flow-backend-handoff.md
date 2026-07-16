---
title: 'Frontend Handoff: Unified Health Center Daily Flow'
description: Practical frontend integration contract for the permission-aware unified Health Center daily read model, counts, pagination, nullability, compatibility, and migration.
createdAt: '2026-07-15T03:34:22.449Z'
updatedAt: '2026-07-15T03:38:48.763Z'
tags:
  - backend-handoff
  - frontend
  - api
  - health-center
  - student-health
  - medication
  - rbac
---

# Frontend Handoff: Unified Health Center Daily Flow

Status: backend implementation complete and locally verified on 2026-07-14. The changes are not committed or deployed by this workflow.

This document is the practical frontend integration contract for the unified Health Center Today read model. API paths include the global /api prefix.

## 1. Backend summary

### What changed

GET /api/health-center/daily-items is now the single permission-aware Health Center Today read model. It composes, without creating a cross-domain database model:

- active, non-archived student health instructions;
- open, non-archived health events visible on the selected day;
- materialized, unrecorded medication administration occurrences classified as DUE or OVERDUE;
- the count of effectively actionable SUBMITTED medication requests;
- independent pagination and complete totals for each visible Today item section;
- access metadata and an authoritative actionRequired count;
- a summaryOnly mode intended for navigation/sidebar polling.

The implementation extends the existing Student Health, Medication Administration, Medication Request, Campus Timezone, RBAC, NestJS controller/DTO, and Prisma repository modules. Composition stays in the application use case; HTTP DTOs and Prisma remain outside the domain layer.

### Important decisions

- No parallel unified endpoint was added. Existing daily-items consumers can continue reading the original instruction/event fields.
- counts.total remains the legacy health-only total: instructions + events.
- visibleTotal includes visible Today item rows only: instructions + events + medication administrations. Medication requests are not item rows and are not included.
- actionRequired includes administration occurrences only when the caller may create the first administration record, and request-review work only when the caller may list, read, and update requests.
- summaryOnly returns complete totals and empty arrays without hydrating item graphs.
- The selected Health Center date controls class enrollment for every slice.
- Medication-request expiration uses actual campus-local today from the request clock, not the selected inspection date.
- A COMPLETED medication request does not suppress an unrecorded occurrence.
- Global Super Admin bypass is centralized in PermissionsGuard and only applies to a globally assigned system role.
- GET /api/health-center/medication-summary remains operational and response-compatible, but is deprecated. New frontend code should not depend on it.
- No database schema or index migration was added for this unified read model.

## 2. Shared request contract

All requests require a Clerk bearer token and selected campus header:

    Authorization: Bearer <Clerk JWT>
    x-campus-id: <campus UUID>

The endpoint uses the standard success envelope:

    {
      "success": true,
      "message": "Health Center daily items retrieved successfully",
      "data": { },
      "timestamp": "2026-07-14T19:30:00.000Z"
    }

Dates are campus calendar dates in YYYY-MM-DD. Do not convert date-only response fields to UTC dates in the frontend. Timestamps such as generatedAt, occurredAt, and recordedAt are ISO-8601 instants.

## 3. Final API contract

### Endpoint

Method and path:

    GET /api/health-center/daily-items

There is no request body.

### Entry authorization

The request may enter when the authenticated user has campus access and at least one of:

- student_health.read
- medication_administration.read
- medication_request.list

A global Super Admin may also enter. Having one entry permission does not reveal the other sections; section access is evaluated independently and reported in data.access.

A user with campus access but none of the three entry permissions receives 403.

### Query parameters

    type HealthCenterDailyItemsQuery = {
      date?: string;                 // YYYY-MM-DD; default is campus-local today
      classId?: string;              // UUID; must belong to selected campus

      instructionsOffset?: number;   // integer >= 0; default 0
      instructionsLimit?: number;    // integer 1..100; default 50

      eventsOffset?: number;         // integer >= 0; default 0
      eventsLimit?: number;          // integer 1..100; default 50

      medicationsOffset?: number;    // integer >= 0; default 0
      medicationsLimit?: number;     // integer 1..100; default 50

      summaryOnly?: "true" | "false"; // strict literal boolean; default false
    };

Malformed UUIDs, dates, offsets, limits, or boolean strings return 400. Values such as summaryOnly=1, summaryOnly=yes, and summaryOnly= return 400.

The three page groups are independent. Changing one offset or limit does not change another group or any total.

### Full response data type

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
        total: number;
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

    type PaginationGroup = {
      offset: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };

For every page group:

    hasMore = offset + limit < total

This formula also applies in summaryOnly mode, where arrays are intentionally empty.

### Access semantics

| Field | True when |
| --- | --- |
| healthItems | caller has student_health.read |
| medicationAdministrations | caller has medication_administration.read |
| medicationRequests | caller has medication_request.list |
| canRecordMedication | caller has medication_administration.read and medication_administration.create |
| canReviewMedicationRequests | caller has medication_request.list, medication_request.read, and medication_request.update |

A false section access field guarantees zero counts, zero pagination total, an empty array where applicable, and no repository query for that domain.

### Count formulas

    counts.total =
      counts.instructions + counts.events

    counts.medicationAdministrations =
      counts.dueMedicationAdministrations
      + counts.overdueMedicationAdministrations

    counts.visibleTotal =
      counts.instructions
      + counts.events
      + counts.medicationAdministrations

    counts.actionRequired =
      (access.canRecordMedication
        ? counts.medicationAdministrations
        : 0)
      + (access.canReviewMedicationRequests
        ? counts.requestsNeedingReview
        : 0)

requestsNeedingReview can be visible while contributing zero to actionRequired. The same is true for medication administration rows when the user has read but not create.

### Health instruction item

    type HealthCenterInstructionItem = {
      id: string;
      studentId: string;
      campusId: string;
      student: {
        id: string;
        fullName: string;
        avatarUrl: string | null;
      };
      class: { id: string; name: string } | null;
      instructionType: "MEDICATION" | "CARE" | "DIET" | "ACTIVITY" | "OTHER";
      title: string;
      instruction: string;
      dosage: string | null;
      startDate: string;
      endDate: string | null;
      timesOfDay: string[];
      scheduleNotes: string | null;
      notes: string | null;
      isActive: boolean;
      status: "ACTIVE";
      createdBy: { id: string; fullName: string | null } | null;
      lastUpdatedBy: { id: string; fullName: string | null } | null;
      createdAt: string;
      updatedAt: string;
    };

Only non-archived instructions active for the selected date are returned.

### Health event item

    type HealthCenterEventItem = {
      id: string;
      studentId: string;
      campusId: string;
      student: {
        id: string;
        fullName: string;
        avatarUrl: string | null;
      };
      class: { id: string; name: string } | null;
      eventType: "ILLNESS" | "INJURY" | "SYMPTOM" | "OBSERVATION" | "OTHER";
      category:
        | "EYE" | "ENT" | "RESPIRATORY" | "SKIN" | "DIGESTIVE"
        | "CARDIAC" | "NEUROLOGICAL" | "MOBILITY" | "OTHER"
        | null;
      title: string;
      description: string | null;
      occurredAt: string;
      status: "OPEN";
      resolutionNotes: string | null;
      recordedBy: { id: string; fullName: string | null } | null;
      lastUpdatedBy: { id: string; fullName: string | null } | null;
      createdAt: string;
      updatedAt: string;
    };

Only non-archived OPEN events are returned. Visibility is capped by the selected day and the request-captured generatedAt instant, so a future event cannot appear during a current-day inspection.

### Medication administration item

This is the same canonical queue shape used by GET /api/medication-administrations/daily:

    type MedicationAdministrationQueueItem = {
      occurrenceId: string;
      requestId: string;
      medicationItemId: string;
      student: {
        id: string;
        fullName: string;
        studentCode: string | null;
      };
      class: { id: string; name: string } | null;
      medicationName: string;
      dosage: string | null;
      instructions: string;
      dueDate: string;
      dueTime: string;
      status: "DUE" | "OVERDUE";
      isOverdue: boolean;
      parentNotes: string | null;
      latestLog: MedicationAdministrationLogSummary | null;
      latestOutcome: "GIVEN" | "SKIPPED" | "REFUSED" | "ABSENT" | null;
      latestLogId: string | null;
      latestRecordedAt: string | null;
      latestRecordedByUserId: string | null;
      latestNote: string | null;
      createdAt: string;
      updatedAt: string;
    };

    type MedicationAdministrationLogSummary = {
      id: string;
      outcome: "GIVEN" | "SKIPPED" | "REFUSED" | "ABSENT";
      recordedByUserId: string;
      recordedAt: string;
      actualTime: string | null;
      note: string | null;
      correctionOfLogId: string | null;
      createdAt: string;
      updatedAt: string;
    };

The Today array contains only materialized occurrences for the selected date whose latestOutcome is null. Therefore latestLog and latest outcome summary fields are normally null for these rows. Recorded occurrences remain available through the canonical medication administration APIs.

The required student summary is never null. Guardian is not part of this response. Class, studentCode, dosage, parentNotes, latest log/outcome fields, health avatar, and health actor summaries may be null.

### Complete example

Request:

    GET /api/health-center/daily-items?date=2026-07-14&classId=44444444-4444-4444-a444-444444444444&instructionsOffset=0&instructionsLimit=20&eventsOffset=0&eventsLimit=20&medicationsOffset=0&medicationsLimit=20
    Authorization: Bearer <token>
    x-campus-id: 11111111-1111-4111-a111-111111111111

Abbreviated response:

    {
      "success": true,
      "message": "Health Center daily items retrieved successfully",
      "data": {
        "campusId": "11111111-1111-4111-a111-111111111111",
        "date": "2026-07-14",
        "classId": "44444444-4444-4444-a444-444444444444",
        "generatedAt": "2026-07-14T15:30:00.000Z",
        "access": {
          "healthItems": true,
          "medicationAdministrations": true,
          "medicationRequests": true,
          "canRecordMedication": true,
          "canReviewMedicationRequests": true
        },
        "counts": {
          "instructions": 12,
          "events": 3,
          "total": 15,
          "medicationAdministrations": 8,
          "dueMedicationAdministrations": 6,
          "overdueMedicationAdministrations": 2,
          "requestsNeedingReview": 3,
          "visibleTotal": 23,
          "actionRequired": 11
        },
        "pagination": {
          "instructions": {
            "offset": 0,
            "limit": 20,
            "total": 12,
            "hasMore": false
          },
          "events": {
            "offset": 0,
            "limit": 20,
            "total": 3,
            "hasMore": false
          },
          "medicationAdministrations": {
            "offset": 0,
            "limit": 20,
            "total": 8,
            "hasMore": false
          }
        },
        "instructions": [
          {
            "id": "55555555-5555-4555-a555-555555555555",
            "studentId": "33333333-3333-4333-a333-333333333333",
            "campusId": "11111111-1111-4111-a111-111111111111",
            "student": {
              "id": "33333333-3333-4333-a333-333333333333",
              "fullName": "Alice Student",
              "avatarUrl": null
            },
            "class": {
              "id": "44444444-4444-4444-a444-444444444444",
              "name": "Sunflower"
            },
            "instructionType": "MEDICATION",
            "title": "Antibiotic after lunch",
            "instruction": "Give after lunch with water.",
            "dosage": "5 ml",
            "startDate": "2026-07-14",
            "endDate": "2026-07-18",
            "timesOfDay": ["12:30"],
            "scheduleNotes": null,
            "notes": null,
            "isActive": true,
            "status": "ACTIVE",
            "createdBy": null,
            "lastUpdatedBy": null,
            "createdAt": "2026-07-14T12:00:00.000Z",
            "updatedAt": "2026-07-14T12:00:00.000Z"
          }
        ],
        "events": [],
        "medicationAdministrations": [
          {
            "occurrenceId": "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
            "requestId": "bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb",
            "medicationItemId": "cccccccc-cccc-4ccc-accc-cccccccccccc",
            "student": {
              "id": "33333333-3333-4333-a333-333333333333",
              "fullName": "Alice Student",
              "studentCode": null
            },
            "class": null,
            "medicationName": "Amoxicillin",
            "dosage": null,
            "instructions": "Give with water.",
            "dueDate": "2026-07-14",
            "dueTime": "10:00",
            "status": "OVERDUE",
            "isOverdue": true,
            "parentNotes": null,
            "latestLog": null,
            "latestOutcome": null,
            "latestLogId": null,
            "latestRecordedAt": null,
            "latestRecordedByUserId": null,
            "latestNote": null,
            "createdAt": "2026-07-13T13:00:00.000Z",
            "updatedAt": "2026-07-13T13:00:00.000Z"
          }
        ]
      },
      "timestamp": "2026-07-14T15:30:00.100Z"
    }

### Summary-only example

    GET /api/health-center/daily-items?summaryOnly=true&instructionsOffset=10&instructionsLimit=1&eventsOffset=2&eventsLimit=2&medicationsOffset=4&medicationsLimit=1

The response contains the same campus/date/class, generatedAt, access, and complete counts. All three item arrays are empty. Pagination still returns the requested normalized page windows. For example, instruction total 12 gives hasMore=true for offset 10 and limit 1.

Use summaryOnly=true for a navigation badge or lightweight periodic refresh. Use the normal response for the Today page.

## 4. Business logic handled by the backend

- Resolves an omitted date from one captured now and the selected campus IANA timezone.
- Rejects a missing or foreign-campus class before any health, administration, or request-count query.
- Derives permissions from the authenticated domain user; no permission input is accepted from the client.
- Applies the selected date to effective class enrollment across all slices.
- Excludes archived health records with no override.
- Computes medication DUE/OVERDUE using campus wall time and daylight-saving-safe boundaries.
- Counts only unrecorded occurrences and never infers occurrence completion from medication-request status.
- Counts requestsNeedingReview only when status is SUBMITTED and endDate is on or after actual campus-local today.
- Excludes NEEDS_MORE_INFO and effectively expired SUBMITTED requests from review work.
- Keeps request count visibility separate from action authority.
- Uses complete filtered totals rather than current page sizes.
- Executes independent authorized reads concurrently after validation.
- Fails the whole request when an authorized slice query fails; it never returns incomplete data marked as authorized.
- Performs no audit write, lifecycle transition, occurrence materialization, or administration log write.

## 5. Frontend responsibilities

- Use data.access to decide which sections/actions to render. Do not infer authorization from a role name.
- Distinguish unauthorized-empty from permitted-empty using access, not array length.
- Use counts.actionRequired directly for the badge. Do not recompute it from visible page rows.
- Keep counts.total as the legacy health-only number. Use visibleTotal for the three Today item domains.
- Preserve date-only and HH:mm strings as campus calendar values.
- Send an explicit date when the user is inspecting a non-current day.
- Refetch daily-items after successful health, request-review, or administration writes. The read endpoint is side-effect free.
- Continue using POST /api/medication-administrations/:occurrenceId/record for first records and corrections under its existing contract.
- Continue using the canonical staff medication-request list/detail/review routes when the user opens Needs Review; this endpoint returns only the count.
- Do not hide an occurrence because its request is COMPLETED.
- Render normal fallbacks for nullable class, avatar, dosage, notes, and actor/log fields.
- Handle a 409 from write commands by refetching the affected canonical resource and then the unified summary.
- Avoid new usage of the deprecated medication-summary endpoint.

## 6. Error responses

The standard error envelope is:

    {
      "statusCode": 400,
      "message": ["summaryOnly must be a boolean value"],
      "error": "Bad Request"
    }

| Status | Meaning and frontend action |
| --- | --- |
| 400 | Invalid date, strict boolean, UUID, offset, or limit. Display validation message and do not retry unchanged. |
| 401 | Missing/invalid Clerk token. Reauthenticate. |
| 403 | Missing campus access or no qualifying entry permission. Treat as inaccessible, not empty. |
| 404 | Campus or class is missing/outside selected campus. Clear stale selection or refetch campus data. |
| 500/other | An authorized backend slice failed. Show one unified failure state; do not display cached partial response as current. |

## 7. Compatibility and migration notes

Existing daily-items frontend code that reads only campusId, date, classId, counts.instructions, counts.events, counts.total, instruction/event pagination, instructions, and events remains compatible. New fields are additive.

Legacy endpoint:

    GET /api/health-center/medication-summary

It remains operational with the same query, guard, and response shape, but Swagger marks it deprecated. It requires campus access plus medication_request.read and medication_administration.read, or global Super Admin. Its response still contains medication.pendingRequests, dueToday, overdue, needsMoreInfo, and links. Do not combine its counts with the unified response and do not add new frontend dependencies on it.

Canonical write endpoints and GET /api/medication-administrations/daily are unchanged.

## 8. Known issues and follow-ups

- This workflow did not deploy or commit the implementation.
- No new database index was added. The final predicates use existing campus/date/status/enrollment scopes; validate production query plans after real data volume is available before adding an index.
- The old medication-summary endpoint remains temporarily for compatibility and can be removed only after all consumers migrate.
- The unified endpoint returns request-review counts, not request rows.
- There is no cross-domain persisted Health Center aggregate; each response is composed from authoritative domain tables.
- Swagger is available at /docs only outside production.

## 9. Backend references

Canonical specification:

/Users/hvu/Desktop/Cod/kindercare_backend/.knowns/docs/specs/2026-07-14/health-unified-flow-backend.md

HTTP and DTO contracts:

- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/health-center.controller.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/controllers/health-center-medication-summary.controller.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/dtos/student-health/health-center-daily-items.query.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/dtos/student-health/health-center-daily-items.response.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/http/dtos/medication/medication-administration.response.ts

Application orchestration and canonical mapping:

- /Users/hvu/Desktop/Cod/kindercare_backend/src/application/student-health/use-cases/get-health-center-daily-items.use-case.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/application/medication/use-cases/get-daily-medication-administrations.use-case.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/application/rbac/permission-access.ts

Persistence:

- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/persistence/prisma/repositories/prisma-student-health-instruction.repository.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/persistence/prisma/repositories/prisma-student-health-event.repository.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/persistence/prisma/repositories/prisma-medication-administration.repository.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/src/infra/persistence/prisma/repositories/prisma-medication-request.repository.ts
- /Users/hvu/Desktop/Cod/kindercare_backend/prisma/schema.prisma


## 10. Performance and index review

No schema migration was added for this feature. A static predicate/index review found:

- student_health_instruction_health_center_idx matches the campus, archivedAt, active-state, and date predicates used by Health Center instruction reads/counts;
- student_health_event_health_center_idx matches the campus, archivedAt, status, and occurredAt predicates used by Health Center event reads/counts;
- med_admin_occurrence_daily_idx matches campus, dueDate, and dueMinute for occurrence paging, with latestOutcome filtered additionally;
- medication request review counting uses campusId, SUBMITTED status, and endDate. The current medication_request_campus_status_start_idx starts with campusId and status but indexes startDate rather than endDate.

The request count may become a candidate for a campusId/status/endDate index at large production volumes, but this workspace had no connected representative PostgreSQL dataset on which to run a meaningful EXPLAIN or EXPLAIN ANALYZE. Adding an index without row distribution and plan evidence would be speculative. Capture production-like query plans and latency before introducing that migration.


## 11. Verification result

Verified on 2026-07-14 in `/Users/hvu/Desktop/Cod/kindercare_backend`:

- Prisma schema validation and client generation passed.
- TypeScript typecheck and NestJS build passed.
- Full Jest passed: 309 suites, 2,423 tests passed, 1 skipped, 0 failed.
- Health unified-flow scoped ESLint passed.
- `git diff --check` passed.
- Repository-wide ESLint remains blocked by three pre-existing errors outside this feature scope: one unused `_input` in `src/application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts` and two existing `no-control-regex` findings in `src/core/utils/security.utils.ts`. These unrelated files were intentionally not changed.
