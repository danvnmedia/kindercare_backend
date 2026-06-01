---
title: Meal Menu Backend Research
description: Backend research findings for the meal-menu system before writing the implementation spec.
createdAt: '2026-05-30T01:36:09.140Z'
updatedAt: '2026-05-30T01:36:09.140Z'
tags:
  - reference
  - research
  - backend
  - meal-menu
  - spec-input
---

## Goal

Backend research for the meal-menu feature before writing the backend spec. The frontend handoff is @doc/references/meal-menu-system-backend-handoff; it is useful product input, not the backend source of truth.

## Existing Backend Context

- No existing meal-menu implementation was found in `src/` or `prisma/`.
- The feature should be added as a new clean-architecture feature/module rather than hidden inside the existing content-management campus settings surface.
- Existing project shape is Domain → Application → Infrastructure → HTTP.
- HTTP feature modules are aggregated in `src/infra/http/http.module.ts`.
- Feature modules register controllers, use cases, repositories, `StandardResponseModule`, `CampusModule`, and `RequestContextModule` when campus guards are used.

## Reusable Patterns

### Campus scoping

Use `@RequireCampusAccess()` and `@CampusContext() campusId: string` on every endpoint. Do not accept trusted `campusId` from request bodies.

For paginated repositories, pass campus scope through `PrismaQueryService.executeQuery(..., { scope: { campusId, ... } })` or an equivalent system-enforced `where`/`scope` combination. Do not put `campusId` in user-controlled allowed filter fields.

Relevant docs:

- @doc/guides/working-with-campuses
- @doc/patterns/decorators-pattern
- @doc/patterns/guards-pattern
- @doc/patterns/repository-pattern

### List response shape

`GET /meal-menus` needs entries and optional grade-level summary in each list row. Use one of these patterns:

1. Domain aggregate includes child entries and grade-level snapshot, with repository `include` hydration and response DTO `@Expose()` / `@Type()` fields; or
2. For list-only projection needs, use the existing raw-row projection pattern: call `PrismaQueryService.executeQuery(..., null)`, then post-map to a flat list-item view. This avoids polluting the domain entity with derived/list-only fields.

Memory: `List endpoint with derived aggregates: null MapperClass + post-map flat view`.

### Filtering/sorting

Standard list grammar supports JSON `filter` and comma `sort`:

- `?sort=-weekStartDate`
- `?filter={"weekStartDate":{"between":["2026-06-01","2026-06-30"]}}`
- Operators include `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `ilike`, `in`, `not_in`, `between`.

Important limitation: current filter parsing ignores `null` values inside operator objects. A whole-campus `gradeLevelId = null` filter likely needs one of:

- a dedicated query parameter such as `target=campus|grade` / `includeWholeCampus`, translated in the use case or repository into trusted `where` clauses; or
- a small extension to the standard filter grammar to support null equality safely.

Do not pretend `filter={"gradeLevelId":{"eq":null}}` works without verifying or changing `PrismaQueryService`.

### Soft delete/archive

Existing features use both `isArchived` (student/category/reference data) and `isDeleted` + `deletedAt` (posts/comments/files). For meal menus, frontend says archived/deleted and expects `isArchived`, so the backend spec should choose `isArchived boolean` for consistency with admin reference/list features and the handoff response shape.

Deletion should be `DELETE /meal-menus/:id` soft-archive, with optional `PATCH /meal-menus/:id/restore` if we want parity with student restore flows.

### Settings/config

Existing `CampusSetting` belongs to content management (`requireTeacherApproval`, `maxPinnedPosts`, comments/reactions) and is exposed at `/campus-settings`. It should not be extended for meal-menu defaults unless intentionally broadening that aggregate.

Prefer a dedicated campus-scoped `MealMenuConfig` / `meal_menu_config` table with one row per campus and defaults:

- `operatingDays = [1,2,3,4,5]`
- `defaultMealSlots = ["Breakfast", "Lunch", "Afternoon"]`

`GET /meal-menus/config` can either return default domain object without persisting or follow existing campus-setting behavior and create defaults on first read. Spec should decide; frontend prefers receiving defaults clearly.

### Grade-level validation

For any grade-targeted menu, validate `gradeLevelId` exists and `gradeLevel.campusId === input.campusId`. Cross-campus entity access usually surfaces as NotFound in newer use cases to hide existence; older class code sometimes uses BadRequest. Prefer NotFound for cross-campus grade target lookup in the new feature.

Relevant code precedent:

- `src/application/class-management/use-cases/school-year-enrollment/register-for-school-year.use-case.ts`
- `src/application/class-management/use-cases/class/create-class.use-case.ts`

### Date handling

Existing date-only columns use Prisma `DateTime @db.Date`. DTOs often accept ISO strings (`@IsDateString`) and convert/validate in use cases. Meal menu should normalize to UTC date-only and reject non-Monday `weekStartDate` in the use case/domain factory.

### Prisma uniqueness with nullable grade target

The frontend handoff is correct: plain Prisma `@@unique([campusId, gradeLevelId, weekStartDate])` will not make `gradeLevelId = NULL` rows collide under normal PostgreSQL unique semantics.

Project memory confirms the pattern:

1. Keep a matching `@@unique` in `schema.prisma` for Prisma Client type awareness.
2. In migration SQL, drop Prisma's generated unique index and recreate with PostgreSQL 15+ `NULLS NOT DISTINCT`, or use two partial unique indexes.
3. Add an inline schema comment explaining the raw SQL replacement.

Prefer `NULLS NOT DISTINCT` if the project is PostgreSQL 15+ (existing migration already uses it). For meal menus:

```sql
CREATE UNIQUE INDEX "meal_menu_natural_key"
  ON "meal_menu" ("campus_id", "grade_level_id", "week_start_date")
  NULLS NOT DISTINCT;
```

Memory: `Prisma @@unique cannot express NULLS NOT DISTINCT — apply via raw SQL`.

### Entries persistence

Normalized child entries are the stronger backend choice for v1 and future work:

- parent `meal_menu` snapshots days and meal slots
- child `meal_menu_entry` rows store `day_of_week`, `slot`, `description`
- unique child cell index on `(meal_menu_id, day_of_week, slot)`
- parent-to-entry relation uses cascade delete

A JSON grid would satisfy v1 but weakens validation, future CSV import, viewer resolution, and any future search/reporting.

### Whole-grid update

Frontend wants explicit save of the whole grid. Backend should model PATCH as metadata update plus whole-grid replacement/upsert for entries. Repository can implement update with nested `deleteMany: {}` + `create` inside a single Prisma update, or a transaction if parent and child operations are separate.

Validate before persistence:

- `days` unique integers 1..7
- `mealSlots` non-empty trimmed unique strings
- every entry day is in `days`
- every entry slot is in `mealSlots`
- duplicate `(dayOfWeek, slot)` cells rejected or normalized consistently
- descriptions trimmed, with blank handling specified

### Authorization / RBAC

New endpoints should use permissions, not legacy role-name guards. Current permission IDs use `module.action`, for example `post.create`, `student.read`, `setting.update`.

Recommended permission IDs:

- `meal_menu.create`
- `meal_menu.read`
- `meal_menu.update`
- `meal_menu.delete`
- `meal_menu.list`
- `meal_menu_config.read`
- `meal_menu_config.update`

Add them to `SYSTEM_PERMISSIONS` in `src/application/rbac/use-cases/seed-permissions.use-case.ts`, then guard routes with `@UseGuards(PermissionsGuard)` and `@Permissions(...)`.

Project memory warns RBAC is plumbed but many routes still lack permission coverage; default new endpoints should enforce permissions.

## Files / Areas to Reuse

- `prisma/schema.prisma` — add models near campus/class/content sections and update `Campus` / `GradeLevel` relations.
- `prisma/migrations/20260527030000_staff_multi_type_refactor/migration.sql` — example of raw SQL `NULLS NOT DISTINCT` uniqueness.
- `src/core/modules/standard-response/services/prisma-query.service.ts` — pagination/filter/sort behavior and scope merge order.
- `src/infra/http/controllers/post.controller.ts` — campus-scoped paginated controller with `@StandardResponse({ isPaginated: true })`.
- `src/infra/http/controllers/post-category.controller.ts` — soft-archive and simple campus-scoped list pattern.
- `src/infra/http/controllers/audit/audit.controller.ts` — controller-level `PermissionsGuard` + per-route `@Permissions` pattern.
- `src/infra/persistence/prisma/repositories/prisma-class.repository.ts` — raw projection/list item precedent for enriched list rows.
- `src/infra/persistence/prisma/repositories/prisma-campus-setting.repository.ts` and related campus-setting use cases — config upsert/read-default precedent, but domain is CMS-specific.
- `src/application/class-management/use-cases/school-year-enrollment/register-for-school-year.use-case.ts` — newer NotFound-style cross-campus related-entity validation and transaction/audit precedent.
- `src/infra/http/modules/class-management.module.ts`, `src/infra/http/modules/content-management.module.ts`, `src/infra/http/modules/audit.module.ts` — module wiring examples.

## Backend Spec Decisions To Lock

1. New module name/location: likely `meal-menu` / `meal-menus` as its own bounded context.
2. Persistence: normalized entries, dedicated config table, `isArchived` soft-delete.
3. Uniqueness: raw SQL `NULLS NOT DISTINCT` natural key for `(campus_id, grade_level_id, week_start_date)`.
4. Filter encoding for whole-campus rows because existing filter grammar does not handle null equality.
5. Whether `GET /meal-menus/config` persists defaults on first read or returns defaults without write.
6. Permission IDs and whether to seed/admin-role assignment in the same spec/task set.
7. Whether to include optional `PATCH /meal-menus/:id/restore` in v1.
8. Whether mutation use cases emit audit events now. If yes, use `TransactionRunnerPort` / UoW + `AuditEventRecorderPort` atomically.

## Recommended Backend API Shape

- `GET /meal-menus` — campus-scoped paginated list, default sort `weekStartDate desc`, system scope excludes archived by default, returns entries + grade-level summary.
- `GET /meal-menus/:id` — campus-scoped detail, returns entries + grade-level summary.
- `POST /meal-menus` — create menu; body owns `weekStartDate`, `gradeLevelId|null`, `title?`, `days`, `mealSlots`, `entries`.
- `PATCH /meal-menus/:id` — update metadata and replace whole grid.
- `DELETE /meal-menus/:id` — soft archive.
- Optional `PATCH /meal-menus/:id/restore`.
- `GET /meal-menus/config` — campus defaults.
- `PUT /meal-menus/config` — upsert defaults for future menus only.

## Spec Warning

The frontend handoff's broad product shape is aligned with backend architecture, but it should be corrected in the backend spec on:

- dedicated config table rather than reusing CMS `CampusSetting`
- permission naming using existing dot format (`meal_menu.read`) instead of colon format (`meal-menu:read`)
- explicit null-filter handling for whole-campus target
- explicit raw-SQL uniqueness for nullable grade target
- normalized entries as backend recommendation
