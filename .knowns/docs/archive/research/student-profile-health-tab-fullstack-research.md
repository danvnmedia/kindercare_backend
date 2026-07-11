---
title: Student Profile Health Tab Fullstack Research
description: Fullstack research input for a Student Profile Health tab spec, combining backend support/gaps with frontend route, component, and data integration findings.
createdAt: '2026-06-30T18:37:09.643Z'
updatedAt: '2026-07-10T22:05:08.450Z'
tags:
  - health
  - student-health
  - student-profile
  - backend-spec
  - frontend
  - archived
---

# Student Profile Health Tab Fullstack Research

## Purpose

Prepare spec input for the Student Profile Health tab by combining the backend research/handoff with current frontend implementation and existing frontend screen specs.

The immediate user request is to create a `kn-spec` for the Student Health tab after researching both backend and frontend. This document captures the researched facts and the decisions still required before the spec can be finalized.

## Source Context

- @doc/archive/frontend-handoff/student-health-management-frontend-handoff
- @doc/archive/research/student-health-management-backend-research
- Frontend repo: `/Users/howznguyen/Workspaces/DHA-Enterprise/kindercare_frontend`
- Frontend docs inspected:
  - `.knowns/docs/specs/2026-07-01/student-profile-health-tab.md`
  - `.knowns/docs/specs/2026-07-01/student-profile-health-tab-shape.md`
  - `.knowns/docs/specs/2026-06-30/student-health-management-frontend-screens.md`

## Backend Reality

No dedicated health backend currently exists.

Confirmed missing backend capabilities:

- No `StudentHealthProfile` model/API.
- No checkup/growth-measurement model/API.
- No medical instruction or parent medical request model/API.
- No health history/timeline API.
- No health intake token/link API.
- No health attachment association/policy.
- No health-specific RBAC permission module.
- No medication administration event logging.

Existing backend systems that can be reused as implementation patterns:

- Student profile endpoints and campus scoping for profile shell/header context.
- Guardian current-user/campus relationship APIs for parent self-service patterns.
- Absence Request vertical slice as the closest parent-submitted request + staff review reference.
- RBAC permission seeding and `PermissionsGuard` conventions.
- Campus guard/current campus request context.
- Audit patterns for entity mutations.
- File service may be reusable later, but medical attachment policy is not decided.

Important backend constraints for the spec:

- Current `Student` rows are campus-scoped.
- Existing student API does not return health fields.
- `PATCH /api/students/:id` must not be used for health fields; unknown fields are rejected by backend validation.
- Health data is sensitive and should not inherit ordinary student profile visibility by accident.
- Parent routes should not trust `guardianId` or `userId` from the client; parent identity should be resolved server-side from authenticated user plus selected campus.

## Frontend Reality

The current frontend profile route is:

- `/dashboard/students/[studentId]`
- File: `src/app/dashboard/(people)/students/[studentId]/page.tsx`

Existing student profile data hooks:

- `useStudent(studentId)`
- `useStudentGuardians(studentId)`

Existing student service anchors:

- `src/features/students/services/student.service.ts`
- `src/features/students/hooks/keys.ts`
- `src/features/students/hooks/use-student.ts`
- `src/features/students/types.ts`

The frontend API client:

- Injects Clerk bearer token.
- Injects `X-Campus-Id` from active campus context.
- Unwraps the backend response envelope.
- Converts standard backend errors into `ApiError`.
- Serializes `filter` query objects to JSON.

Existing profile tab system:

- `src/components/app-wide/profile/profile-tabs.tsx`
- Uses query-state tab behavior, so a `Health` tab can be deep-linked with the existing pattern.

Current Student Profile tabs:

- `Info`
- `Guardians`
- `Academic history`

The Health tab does not exist yet.

## Frontend Shape Already Researched

The latest frontend direction is not the older multi-section dashboard shape. The current preferred Health tab shape is compact:

1. `Health Snapshot`
   - allergies
   - conditions
   - restrictions
   - emergency notes
   - scope badge such as `Current campus record`
   - last-updated metadata when available

2. `Records`
   - one unified panel below the snapshot
   - internal categories: `Checkups`, `Medical Instructions`, `Parent Requests`, `Documents`
   - defaults to `Checkups`
   - rows show recent records only
   - row details open in modal/dialog/drawer

Recommended visible V1 components:

- `HealthSnapshotPanel`
- `HealthRecordsPanel`
- `HealthRecordDetailDialog`

The frontend docs explicitly say not to calculate or display BMI, BMI percentile, growth percentile, or clinical interpretation unless backend/product defines and supplies the values.

## Frontend Integration Implications

The frontend can add the Health tab shell and fixture-backed UI now, but cannot persist or fetch real health data until backend APIs exist.

When backend APIs exist, frontend should add health-specific services and hooks rather than extending `studentService.update()` with health fields.

Likely frontend implementation anchors:

- Add `Health` to the existing Student Profile `ProfileTabs` config in the student profile page.
- Create health feature folder or subfeature under students, depending on repo convention.
- Add health query keys that include active campus ID where data is campus-scoped.
- Reuse absence-request hook/service patterns for parent/staff request flows if those become V1.
- Use permission/campus context from `CampusProvider` for UI gating once backend permission names are locked.

## Scope Conflict Found

There are two competing frontend scopes in existing docs:

1. Broad Student Health Management V1:
   - parent medical requests list/create/detail
   - staff medical requests dashboard/review
   - Student Profile Health tab
   - later intake/teacher administration screens

2. Narrow Student Profile Health tab V1:
   - staff-facing tab only
   - compact Health Snapshot + Records panel
   - checkups/growth measurements emphasized
   - parent requests, medical instructions, and documents represented as record categories but may be unavailable until backend supports them

The latest shape/spec docs favor option 2 for this specific Student Profile Health tab spec.

## Decisions Required Before Spec Draft

The spec should not be finalized until these are locked:

1. V1 product scope:
   - Health tab only, or health tab plus parent/staff medical request workflows.

2. Data ownership/scope:
   - current-campus health record only, student-global record, or cross-campus readable history.

3. Backend domain shape:
   - separate health snapshot/checkup/medical request/document endpoints, or one unified records endpoint plus detail endpoints.

4. Permission names and actions:
   - health read/update/add-checkup/review/download/administer.

5. Medical documents:
   - real V1 support, hidden category, or disabled/empty category.

6. Parent visibility:
   - whether parents can see checkup measurements or only submit medical instructions.

7. Clinical calculations:
   - whether backend supplies BMI/percentiles or they are out of scope.

## Recommended Spec Direction

Recommended first spec: staff-facing Student Profile Health tab backend+frontend contract, with V1 focused on:

- Health Snapshot read/update.
- Checkup records create/list/detail with height/weight as event fields.
- Records panel data contract that can include empty/unavailable categories for medical instructions, parent requests, and documents.
- Current-campus wording until cross-campus continuity is explicitly designed.
- No BMI/percentile calculation in frontend.
- No parent medical request dashboard/intake/administration logging unless product confirms those are part of this V1.

This keeps the spec implementable and aligned with the latest frontend shape while leaving broader medical request workflows for a follow-up spec if needed.
