---
id: dezwyv
title: weekly-plan-activity-title-02 Update Weekly Plan API Contract And Verification
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - activity-title
  - api
createdAt: '2026-06-24T13:33:23.432Z'
updatedAt: '2026-06-24T13:53:09.413Z'
timeSpent: 527
assignee: '@me'
spec: specs/weekly-plan-activity-title-and-description
fulfills:
  - AC-1
  - AC-2
  - AC-3
  - AC-4
  - AC-5
  - AC-6
  - AC-8
  - AC-9
  - AC-10
order: 2
---
# weekly-plan-activity-title-02 Update Weekly Plan API Contract And Verification

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the public Weekly Plan API contract for @doc/specs/weekly-plan-activity-title-and-description so activity requests use `{ title, description? }`, legacy `{ text }` is rejected, all Weekly Plan responses expose `{ order, title, description }`, copy preserves the new fields, and focused verification covers the changed behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Update Weekly Plan request DTOs and OpenAPI docs to accept `title` plus optional nullable `description` and reject legacy `text`-only activities.
- [x] #2 Update Weekly Plan response DTOs and all response mapping paths to expose `{ order, title, description }` with `description: null` when unset.
- [x] #3 Ensure create, update, list, get by ID, active lookup, copy, archive, and restore flows use the new activity response shape.
- [x] #4 Add focused tests for accepted title/description payloads, null/omitted description, title/description length validation, legacy `{ text }` rejection, copy preservation, and response shape.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update weekly-plan request/response DTOs in `src/infra/http/dtos/weekly-plan` so activities accept `title` plus optional nullable `description`, reject text-only payloads through validation/domain normalization, and document the new OpenAPI shape.
2. Update Weekly Plan application/use-case test fixtures and assertions from `text` to `title`/`description`, including accepted description, omitted/null description, legacy `{ text }` rejection, title/description length validation, response shape, and copy preservation.
3. Verify all public response paths continue to serialize through `WeeklyPlanResponse` / `ActiveWeeklyPlanResponse`, covering create, update, list, get by ID, active lookup, copy, archive, and restore.
4. Run focused weekly-plan domain/use-case tests, Prisma validation/generation, broad build with a longer timeout, task validation, then mark ACs done and run SDD validation if this completes the spec.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Weekly Plan API contract update for activity title/description: request DTOs now expose `title` plus optional nullable `description`, response DTOs expose `{ order, title, description }`, use-case fixtures/assertions use the new shape, legacy `{ text }` payloads are rejected by domain validation before per-class processing, copy preserves title/description, and a response DTO test verifies `text` is not serialized. Verification: `npx jest application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts domain/weekly-plan/weekly-plan-schedule.spec.ts infra/http/dtos/weekly-plan/weekly-plan.response.spec.ts --runInBand`, `npx prisma validate`, `npx prisma generate --no-engine`, `npm run build`, `validate dezwyv`.
kn-review: PASS after one coverage fix. Review found no blocking implementation issues; added focused domain coverage for non-string activity title/description rejection, then reran `npx jest application/weekly-plan/use-cases/weekly-plan.use-case.spec.ts domain/weekly-plan/weekly-plan-schedule.spec.ts infra/http/dtos/weekly-plan/weekly-plan.response.spec.ts --runInBand` and `npm run build` successfully.
<!-- SECTION:NOTES:END -->

