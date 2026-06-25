---
title: Weekly Plan Daily Schedule Backend Research
description: Backend research and spec-shaping notes for Weekly Plan Daily Schedule based on the frontend handoff and existing backend architecture
createdAt: '2026-06-18T11:41:56.807Z'
updatedAt: '2026-06-18T11:41:56.807Z'
tags:
  - research
  - weekly-plan
  - schedule
  - backend-spec
---

# Weekly Plan Daily Schedule Backend Research

## Purpose

Research notes for shaping a backend spec from @doc/frontend-handoff/weekly-plan-daily-schedule-frontend-handoff. The frontend handoff is useful product/API context, but it is not the backend source of truth. Backend implementation should follow this repo's Clean Architecture, multi-campus, RBAC, audit, standard response, and Prisma migration conventions.

## Source Context

Frontend-approved scope from the handoff:

- Weekly Plan Daily Schedule is class-specific.
- Each active plan belongs to exactly one campus, one class, and one canonical Monday `weekStartDate`.
- Multi-class create/copy is a batching convenience that must create independent per-class records.
- A plan has an optional week theme and daily schedule blocks.
- Each block has `dayOfWeek`, `startTime`, `endTime`, and one or more ordered activities.
- Backend must enforce Monday week starts, duplicate active plan prevention, campus/class ownership, non-overlapping blocks per day, non-empty activities, ordered activities, archive/restore conflict behavior, and permissions.

Important correction: @doc/specs/meal-menu-class-targeting is a precedent for weekly records, archive/restore, campus scoping, active-only uniqueness, and class ownership validation, but Weekly Plans should not inherit Meal Menu target fallback. Weekly Plans are class-only and should use exact class/week semantics.

## Current Backend Reality

No existing weekly-plan or daily-schedule backend implementation was found via Knowns code search for `weekly plan daily schedule`.

Reusable precedents:

- `src/domain/meal-menu/entities/meal-menu.entity.ts`: aggregate-style entity with `weekStartDate`, child grid entries, archive/restore, `ensureActive()`, target identity invariants, and defensive cloning of child collections.
- `src/domain/meal-menu/meal-menu-grid.ts`: `toUtcDateOnly()` and `normalizeWeekStartDate()` normalize a date-only Monday anchor and reject non-Monday values.
- `src/application/meal-menu/use-cases/menu/*.use-case.ts`: create/update/copy/archive/restore use cases validate target ownership, check active natural-key conflicts, and wrap mutations plus audit records in `UnitOfWorkPort`.
- `src/infra/persistence/prisma/repositories/prisma-meal-menu.repository.ts`: standard list behavior uses `PrismaQueryService`, allowed filters/sorts, default `isArchived=false`, and exact active natural-key lookup.
- `src/infra/persistence/prisma/unit-of-work/transaction-operations/meal-menu.transaction-ops.ts`: child rows are replaced with nested `deleteMany` + `create` inside the same transaction.
- `src/infra/http/controllers/meal-menu.controller.ts`: route shape uses `GET /meal-menus`, `GET /meal-menus/:id`, `POST /meal-menus`, `PATCH /meal-menus/:id`, `POST /meal-menus/:id/copy`, `DELETE /meal-menus/:id`, and `PATCH /meal-menus/:id/restore`, with campus context, permissions, Swagger docs, and `StandardResponse`.
- `prisma/schema.prisma` + `prisma/migrations/20260603162000_add_meal_menu_class_targeting/migration.sql`: active-only uniqueness for archived records is enforced with raw partial unique indexes because Prisma cannot express `WHERE is_archived = false`.
- `src/application/class-management/ports/class.repository.ts` and `src/infra/persistence/prisma/repositories/prisma-class.repository.ts`: class lookup/listing already exposes campus, grade, school year, staff preview, and active student count. Weekly-plan write use cases should validate classes through this repository.
- `src/application/class-management/use-cases/enrollment/bulk-enroll-students.use-case.ts`: batch precedent uses whole-call validation for request-level failures, per-row `skipped[]` for row conflicts, and atomic persistence for survivors.
- `src/domain/rbac/entities/permission.entity.ts` and `src/application/rbac/use-cases/seed-permissions.use-case.ts`: new permission modules must be added both to `VALID_MODULES` and `SYSTEM_PERMISSIONS`.
- `src/domain/audit/audit-action.enum.ts`, `src/application/audit/action-visibility.spec.ts`, and `src/application/meal-menu/use-cases/meal-menu-audit.ts`: audited feature mutations require action tuple additions, visibility mapping, context shape updates, and transaction-bound `recordAudit()` calls.

Relevant docs:

- @doc/frontend-handoff/weekly-plan-daily-schedule-frontend-handoff
- @doc/specs/meal-menu-class-targeting
- @doc/architecture/multi-campus-architecture
- @doc/architecture/rbac-system
- @doc/architecture/audit-trail-soft-delete-patterns
- @doc/patterns/prisma-migration-patterns
- @doc/patterns/unit-of-work-pattern
- @doc/patterns/use-case-pattern
- @doc/patterns/entity-pattern
- @doc/guides/pagination-and-filtering
- @doc/conventions/implementation-checklist

## Recommended Backend Spec Shape

### Domain and Naming

Use a new Weekly Plan vertical slice with route/module name `weekly-plans` unless product chooses another term. Prefer a new domain/application module (`weekly-plan`) rather than folding schedule logic into meal-menu or class-management.

Permission module should likely be `weekly_plan` to match snake-case RBAC modules such as `meal_menu`. Route permissions should likely be:

- `weekly_plan.list`
- `weekly_plan.read`
- `weekly_plan.create`
- `weekly_plan.update`
- `weekly_plan.delete`

Restore can reuse `weekly_plan.update` unless the spec intentionally adds a dedicated restore permission.

### Persistence Model

Recommended schema shape:

- `WeeklyPlan`
  - `id UUID`
  - `campusId UUID`, required, `onDelete: Restrict`
  - `classId UUID`, required, `onDelete: Restrict`
  - `weekStartDate DateTime @db.Date`
  - `theme String?` with a spec-defined max length
  - `isArchived Boolean @default(false)`
  - universal `createdAt` and `updatedAt`
  - indexes on `campusId`, `classId`, `weekStartDate`, `isArchived`
- `WeeklyPlanBlock`
  - belongs to `WeeklyPlan`, `onDelete: Cascade`
  - `dayOfWeek Int`
  - `startMinute Int` and `endMinute Int`, or another explicitly chosen time representation
  - optional `order Int` if response order must be stable beyond chronological sort
- `WeeklyPlanActivity`
  - belongs to `WeeklyPlanBlock`, `onDelete: Cascade`
  - `order Int`
  - `description Text` or bounded string based on spec decision

Use a raw SQL partial unique index for active-only duplicate prevention:

```sql
CREATE UNIQUE INDEX "weekly_plan_active_class_week_key"
  ON "weekly_plan" ("campus_id", "class_id", "week_start_date")
  WHERE "is_archived" = false;
```

Do not rely only on application checks; use both a use-case conflict check and DB-level protection, mirroring meal-menu.

### Time Representation

The repo has date-only `@db.Date` patterns and timestamp patterns, but no established PostgreSQL `@db.Time` usage. For schedule blocks, prefer timezone-free time-of-day storage.

Recommended internal representation: integer minutes from midnight (`startMinute`, `endMinute`, 0..1440, `startMinute < endMinute`). The API can expose either minutes or `HH:mm`; the spec should lock one. If exposing `HH:mm`, DTO/domain parsing should normalize to minutes before overlap validation. Avoid `DateTime` for block times because it introduces timezone/date semantics the feature does not need.

### Validation Rules

Backend must enforce, in the domain/use-case layer and DTOs where possible:

- `campusId` comes only from `@CampusContext()`, never the request body.
- `classId` must exist and belong to active campus; missing/cross-campus class should use not-found style behavior.
- `weekStartDate` must be a valid date-only Monday anchor, normalized like meal-menu.
- One active weekly plan per campus/class/week.
- Archived plans cannot be updated or copied unless restored first.
- Restore fails if another active plan now exists for the same campus/class/week.
- Blocks require valid `dayOfWeek`, `start`, `end`, and at least one activity.
- `start < end`.
- Blocks in the same day must not overlap. Boundary-touching should be allowed only if the spec states it (`end == next.start` is normally non-overlap).
- Blocks should be returned sorted by `dayOfWeek`, `start`, then optional `order`/`id`.
- Activities must be non-empty after trim and must preserve order.

Overlap validation is new; no shared overlap validator was found.

### API Shape

Recommended endpoints, aligned with meal-menu conventions:

- `GET /weekly-plans` for standard paginated list.
  - Use standard `limit`, `offset`, `sort`, `filter` query behavior.
  - Allow filters for `classId`, `weekStartDate`, `isArchived`, `createdAt`, `updatedAt`, and possibly date range through standard filtering.
  - Default list should exclude archived unless `isArchived` filter is supplied.
- `GET /weekly-plans/:id` includes archived rows for authorized read callers.
- `GET /weekly-plans/active?classId=...&weekStartDate=...` returns `200` with `plan: null` for a valid class/week with no active plan, and `404` for missing/cross-campus class. This mirrors the `meal-menus/effective` no-match behavior without adding fallback semantics.
- `POST /weekly-plans` creates one or more independent plans.
- `PATCH /weekly-plans/:id` updates one active plan.
- `POST /weekly-plans/:id/copy` copies whole-week content to one or more destination class/week pairs.
- `DELETE /weekly-plans/:id` archives.
- `PATCH /weekly-plans/:id/restore` restores if no active conflict exists.

Day copy can remain frontend-local plus a normal full-plan update unless the backend spec wants day-copy audit/concurrency semantics. If server-side day copy is added, it should be its own use case and audit action.

### Batch Semantics

If `POST /weekly-plans` and copy support multiple destination classes, use the repo's bulk enrollment precedent:

- Whole-call validation aborts with 4xx for malformed schedule payload, non-Monday week, empty `classIds`, duplicate class IDs in the request, invalid destination week, or invalid source plan.
- Per-class conflicts produce `skipped[]` with stable machine reasons, such as `CLASS_NOT_FOUND`, `CLASS_NOT_IN_CAMPUS`, `ACTIVE_WEEKLY_PLAN_EXISTS`.
- Survivors are persisted atomically in one transaction. A DB failure rolls back survivors.
- Response includes `created` or `copied` plus `skipped`.

If product wants strict all-or-nothing behavior instead, the frontend handoff should be corrected because it currently expects partial batch conflict handling.

### Full Replacement vs Granular Patch

The current meal-menu pattern replaces child rows wholesale during update. Weekly-plan schedule updates can follow that pattern:

- The update DTO carries a full replacement `blocks` array.
- Use case validates the entire replacement schedule.
- Prisma transaction op updates plan fields and nested child rows with delete/create semantics.

Granular block/activity patch endpoints are not required for the frontend handoff and would increase concurrency and invariant complexity.

### Permissions and Audit

RBAC work for the spec should include:

- Add `weekly_plan` to `PermissionEntity.VALID_MODULES`.
- Add `weekly_plan.list/read/create/update/delete` to `SYSTEM_PERMISSIONS`.
- Apply `@UseGuards(PermissionsGuard)` and `@Permissions(...)` on every Weekly Plan route.
- Decide which seed/default roles receive those permissions.

If audit is in scope, add actions such as:

- `CREATE_WEEKLY_PLAN`
- `COPY_WEEKLY_PLAN`
- `UPDATE_WEEKLY_PLAN`
- `ARCHIVE_WEEKLY_PLAN`
- `RESTORE_WEEKLY_PLAN`

Then update `AUDIT_ACTIONS`, action visibility, context-shape docs, export tests, and use `UnitOfWorkPort` so mutation and audit record commit or roll back together.

## Suggested Acceptance Criteria For Backend Spec

- Creating one class plan succeeds and returns class summary, week anchor, theme, sorted blocks, ordered activities, archive state, and timestamps.
- Creating multiple class plans creates independent rows; editing one later does not affect the others.
- Duplicate active campus/class/week create and copy attempts are rejected or skipped according to chosen batch semantics.
- Archived rows do not block new active rows.
- Restore fails when another active row exists for the same campus/class/week.
- Active lookup returns `plan: null` for valid no-plan class/week and not-found for missing/cross-campus class.
- `weekStartDate` rejects non-Monday values.
- Overlapping same-day blocks are rejected.
- Empty activities are rejected; multiple activities per block round-trip in order.
- Update replaces the schedule atomically and does not mutate other plans.
- Copy preserves blocks and activities while applying destination class/week/theme rules.
- Campus isolation and class ownership are enforced for list/detail/create/update/copy/archive/restore/active lookup.
- Weekly Plan RBAC permissions are seeded and enforced.
- If audit is in scope, every mutating use case emits the expected audit action in the same transaction.

## Open Questions To Lock Before Writing The Spec

- API time format: minutes from midnight vs `HH:mm` strings.
- Maximum lengths for `theme` and activity text.
- Whether Saturday/Sunday are allowed; backend can support 1..7 unless product restricts operating days.
- Whether `POST /weekly-plans` is batch-capable or single-create plus frontend fan-out.
- If batch-capable, whether partial per-class success is required or all-or-nothing is preferred.
- Copy theme behavior: preserve source theme by default, allow override, or require explicit choice.
- Whether day-copy should stay frontend-local or become an audited backend use case.
- Whether audit actions are in scope for the first backend implementation.
- Whether empty days should be omitted or represented explicitly. A flat block list makes omission natural and frontend grouping simple.
