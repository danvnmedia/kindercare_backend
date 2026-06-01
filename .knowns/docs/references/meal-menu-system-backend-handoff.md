---
title: Meal Menu System Backend Handoff
description: 'Frontend-to-backend handoff for the meal menu system: product scope, expected endpoints, response shapes, validation, campus scoping, and backend decisions needed before frontend implementation.'
createdAt: '2026-05-30T01:16:06.504Z'
updatedAt: '2026-05-30T01:16:06.504Z'
tags:
  - reference
  - handoff
  - backend
  - frontend
  - meal-menu
---

## Purpose

Frontend is planning a new **Meal Menu System** and needs backend support before implementation can start. This handoff documents what the frontend intends to build, what API/data behavior it expects, and the backend decisions that should be researched and owned by the backend team.

This is intentionally a **handoff/reference**, not a backend implementation spec. Backend should research the existing backend architecture, data model conventions, campus scoping, clean-architecture layering, migrations, DTO/response conventions, and validation rules before writing its own backend spec/tasks.

Relevant backend context to follow:

- @doc/guides/working-with-campuses — campus-aware feature rules.
- @doc/architecture/clean-architecture-overview — layer/dependency conventions.
- @doc/architecture/module-and-request-flow — request/module flow.
- @doc/patterns/guards-pattern — auth/campus/roles/permissions guard patterns.
- @doc/patterns/decorators-pattern — `@RequireCampusAccess`, `@CampusContext`, `@CurrentUser`, roles/permissions decorators.

Source context: approved frontend spec in the frontend project at `specs/meal-menu-system-frontend`.

## What Frontend Is Going to Build

The frontend v1 is an **admin-only weekly meal menu manager** organized as:

```text
week × day × meal slot
```

Each menu is a weekly spreadsheet-like grid:

- **Rows:** operating days snapshotted on the menu, default Mon–Fri, with optional Saturday/Sunday configured per campus.
- **Columns:** meal slots snapshotted on the menu, default `Breakfast / Lunch / Afternoon`, configurable per campus and overridable per menu.
- **Cells:** free-text meal descriptions only. No structured food/nutrition/allergen model in v1.
- **Target:** either whole-campus or one grade level.
- **Time anchor:** `weekStartDate`, always the Monday of the week.

Admin frontend surfaces:

1. `/dashboard/meal-menus` list page.
2. Inline spreadsheet editor via expandable menu rows.
3. Add menu flow.
4. Copy/duplicate menu flow.
5. Per-week slot editing.
6. Menu settings dialog for campus defaults (`operatingDays`, `defaultMealSlots`).
7. Delete/archive menu flow.
8. Filters by school year, Week N, and target.

Explicitly deferred from frontend v1:

- CSV/Excel bulk upload.
- Export menu to image/PDF.
- Parent/guardian-facing viewer.
- Staff/class viewer surface.
- Full-text search across meal descriptions.
- Nutrition/allergen metadata.
- Multi-week/term templates.

## Product Decisions Already Locked by Frontend

- **Editor UX:** inline spreadsheet on the list page; no detail page in v1.
- **Scope:** admin management only.
- **Targeting:** whole-campus or grade-level menu.
- **Fallback rule for future viewer:** when resolving a class menu, use the class grade's menu if it exists for that week; otherwise use the whole-campus menu for that week. This is documented for later viewer work but not required in v1 endpoints unless backend wants to expose it now.
- **Operating days:** configurable per campus, default Mon–Fri; menus snapshot the days when created.
- **Meal slots:** configurable per campus, default `Breakfast / Lunch / Afternoon`; menus snapshot slots when created; individual menus may override slots.
- **Time model:** date-anchored by `weekStartDate` Monday; frontend does **not** expect `schoolYearId` stored on menus.
- **School-year / Week N UI:** frontend computes Week N from existing `SchoolYear.startDate` and translates filters into real `weekStartDate` values/ranges. Backend does not need to store or expose Week N.
- **Save model:** explicit Save of the whole grid; no per-cell autosave.
- **Copy/duplicate:** included in v1. Frontend can compose it client-side by reading the source menu and posting a new menu unless backend prefers a dedicated copy endpoint.
- **Settings location:** in-feature menu settings dialog; not a global Settings page.

## Backend Deliverables Needed

Frontend needs a campus-scoped REST surface for meal menus and meal-menu settings.

### Required endpoints

#### `GET /meal-menus`

Campus-scoped, paginated list endpoint using standard backend pagination/filter/sort conventions.

Frontend needs:

- Default sort: `weekStartDate` descending.
- Filter by `weekStartDate` range.
- Filter by `gradeLevelId`.
- Ability to represent whole-campus target (`gradeLevelId = null`). Backend should choose the exact filter encoding that fits existing filtering conventions and document it for frontend.
- Exclude archived/deleted rows by default.
- Include entries in each returned menu, because the list row expands into an inline grid without a separate route.
- Include grade-level summary when grade-targeted.

#### `GET /meal-menus/:id`

Return one campus-scoped menu with entries and optional grade-level summary.

#### `POST /meal-menus`

Create a menu.

Expected request shape, subject to backend DTO naming conventions:

```ts
{
  weekStartDate: string;           // ISO date-only or ISO datetime representing Monday
  gradeLevelId: string | null;     // null = whole-campus menu
  title?: string;
  days: number[];                  // snapshot, 1=Mon ... 7=Sun
  mealSlots: string[];             // ordered slot labels
  entries: MealEntryInput[];       // can be empty on creation
}

MealEntryInput = {
  dayOfWeek: number;               // must be in days
  slot: string;                    // must be in mealSlots
  description: string;             // free text, may be blank/trimmed per backend rule
}
```

Backend should enforce uniqueness: one menu per `(campusId, target, weekStartDate)`.

Important: whole-campus target must be unique too. If backend uses nullable `gradeLevelId`, remember that plain Postgres/Prisma uniqueness treats `NULL` values as distinct. Use an implementation that makes `(campusId, NULL, weekStartDate)` unique as well, e.g. raw SQL partial unique indexes or `NULLS NOT DISTINCT`, following backend migration conventions. See backend memory/pattern around Prisma `@@unique` + `NULLS NOT DISTINCT`.

#### `PATCH /meal-menus/:id`

Update menu metadata and whole-grid content.

Frontend expects to persist the grid as an explicit Save operation. A simple whole-grid update/upsert is acceptable and preferred for v1:

```ts
{
  title?: string;
  days?: number[];
  mealSlots?: string[];
  entries?: MealEntryInput[];
  gradeLevelId?: string | null;
  weekStartDate?: string;
}
```

Backend should validate:

- `weekStartDate` snaps/normalizes to Monday or rejects non-Monday dates.
- `days` values are unique integers from 1 through 7.
- `mealSlots` are non-empty, ordered labels; duplicate labels should be rejected or normalized consistently.
- Every entry references a day in `days` and a slot in `mealSlots`.
- Duplicate entry cells `(dayOfWeek, slot)` within a menu are rejected or normalized.
- Grade-level target belongs to the active campus.
- Uniqueness conflicts are reported clearly.

#### `DELETE /meal-menus/:id`

Soft-delete/archive a menu.

Frontend expects list/detail invalidation to be sufficient after delete. If backend supports restore patterns, optional:

#### `PATCH /meal-menus/:id/restore` (optional)

Restore an archived menu if consistent with backend deletion conventions.

#### `GET /meal-menus/config`

Return campus-scoped meal-menu defaults.

If no config has been saved for the campus, backend can either return persisted defaults or omit config and let frontend apply defaults. Preferred response for clarity:

```ts
{
  operatingDays: [1, 2, 3, 4, 5],
  defaultMealSlots: ["Breakfast", "Lunch", "Afternoon"]
}
```

#### `PUT /meal-menus/config`

Upsert campus-scoped defaults:

```ts
{
  operatingDays: number[];
  defaultMealSlots: string[];
}
```

Changes affect **future new menus only**. Existing menus retain their snapshotted `days` and `mealSlots`.

## Expected FE-Facing Response Shapes

Exact class names are backend-owned. Frontend needs these fields semantically.

```ts
MealMenuResponse = {
  id: string;
  campusId: string;
  gradeLevelId: string | null;
  gradeLevel?: {
    id: string;
    name: string;
  } | null;
  weekStartDate: string;          // Monday, date-only semantics
  title?: string | null;
  days: number[];                 // snapshot, 1=Mon ... 7=Sun
  mealSlots: string[];            // ordered labels
  entries: MealEntryResponse[];
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

MealEntryResponse = {
  dayOfWeek: number;
  slot: string;
  description: string;
}

MealMenuConfigResponse = {
  operatingDays: number[];
  defaultMealSlots: string[];
}
```

Frontend DTO note: frontend treats backend date fields as JSON strings at runtime and will convert date-only values locally before date math/pickers.

## Suggested Data Model Shape

Backend should choose the final implementation, but frontend expectations fit naturally into a parent menu plus child entries model.

### Option A — normalized entries (recommended handoff shape)

```prisma
model MealMenu {
  id            String   @id @default(uuid()) @db.Uuid
  campusId      String   @map("campus_id") @db.Uuid
  gradeLevelId  String?  @map("grade_level_id") @db.Uuid
  weekStartDate DateTime @map("week_start_date") @db.Date
  title         String?
  days          Int[]    @default([1, 2, 3, 4, 5])
  mealSlots     String[] @map("meal_slots")
  isArchived    Boolean  @default(false) @map("is_archived")

  entries MealMenuEntry[]

  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([campusId])
  @@index([gradeLevelId])
  @@index([weekStartDate])
  @@map("meal_menu")
}

model MealMenuEntry {
  id          String @id @default(uuid()) @db.Uuid
  mealMenuId  String @map("meal_menu_id") @db.Uuid
  dayOfWeek   Int    @map("day_of_week")
  slot        String
  description String

  mealMenu MealMenu @relation(fields: [mealMenuId], references: [id], onDelete: Cascade)

  @@unique([mealMenuId, dayOfWeek, slot])
  @@index([mealMenuId])
  @@map("meal_menu_entry")
}
```

Uniqueness for whole-campus vs grade target likely needs raw SQL, for example either:

- `UNIQUE NULLS NOT DISTINCT (campus_id, grade_level_id, week_start_date)` if supported and consistent with backend migration practice, or
- two partial unique indexes:
  - one for `grade_level_id IS NULL`, unique `(campus_id, week_start_date)`
  - one for `grade_level_id IS NOT NULL`, unique `(campus_id, grade_level_id, week_start_date)`

### Option B — JSON grid

A single JSON grid on `MealMenu` could also satisfy v1 because cells are free-text, but it makes entry-level validation/querying/search harder. Frontend does **not** require entry-level search in v1, but normalized entries are still clearer for future CSV import and viewer/export features.

## Campus Settings Storage

Frontend only needs `GET/PUT /meal-menus/config` semantics. Backend can decide storage:

- reuse existing campus settings infrastructure if appropriate, or
- create a dedicated meal-menu config model/table.

Important behavior:

- Config is campus-scoped.
- Missing config should behave as defaults: `operatingDays = [1,2,3,4,5]`, `defaultMealSlots = ["Breakfast", "Lunch", "Afternoon"]`.
- Updating config must not mutate existing menus.
- New menus snapshot config into `days` and `mealSlots`.

## Filtering and Derived Fields

Frontend will show school-year and Week N filters, but backend should **not** store or derive Week N for this feature.

Frontend behavior:

1. Load school years through existing frontend surfaces.
2. Compute a concrete `weekStartDate` or date range from selected school year + Week N.
3. Send scalar filters to backend (`weekStartDate`, `gradeLevelId`, `isArchived`).

Backend should expose filterable scalar fields only:

- `weekStartDate`
- `gradeLevelId`
- `isArchived`
- optionally `createdAt` / `updatedAt` if standard

Do not design backend-only filters around computed Week N unless backend independently wants that for other reasons.

## Copy / Duplicate Behavior

Frontend can implement copy without a dedicated backend endpoint:

1. Read source menu.
2. Open copy dialog for destination week/target.
3. POST a new menu with copied `days`, `mealSlots`, and `entries` plus destination `weekStartDate` and `gradeLevelId`.

Backend only needs normal create validation and uniqueness conflict reporting. If backend prefers a dedicated endpoint, suggested shape:

```http
POST /meal-menus/:id/copy
```

```ts
{
  weekStartDate: string;
  gradeLevelId: string | null;
}
```

But this is optional, not required by frontend v1.

## Validation and Error Expectations

Frontend needs predictable 4xx errors for inline UX. Backend should document final codes/messages, but the following cases matter:

- duplicate menu for same campus + target + week
- invalid/non-Monday `weekStartDate`
- grade level not found or not in campus
- invalid days array
- empty/duplicate meal slots
- entries referencing a non-enabled day or unknown slot
- unauthorized/forbidden campus access
- menu not found or archived

Preferred error surface: follow existing backend standard error response format. Include machine-readable codes if that pattern already exists for this domain.

## Authorization / Campus Scope Expectations

All endpoints must be campus-scoped using existing backend conventions:

- require authenticated user
- require campus access
- resolve active campus from `x-campus-id`
- validate any `gradeLevelId` belongs to the active campus
- prevent cross-campus read/write leakage

Admin-only frontend surface means backend should apply whatever role/permission convention is appropriate for management endpoints. If fine-grained permissions exist or are planned, likely permissions are:

- `meal-menu:read`
- `meal-menu:create`
- `meal-menu:update`
- `meal-menu:delete`
- `meal-menu-config:read`
- `meal-menu-config:update`

Backend owns exact naming and seed/migration approach.

## Deferred Backend Work

Do not include these in the first backend build unless backend wants to prepare harmless extension points:

- CSV/Excel upload endpoints/parsers.
- image/PDF export endpoints.
- public/parent/staff viewer endpoint.
- class-to-menu resolution endpoint.
- full-text search across entry descriptions.
- nutrition/allergen structured metadata.
- multi-week/term template generator.

For future viewer work, the likely resolution rule is:

```text
(class.gradeLevelId, weekStartDate) grade-specific menu if present
else whole-campus menu for weekStartDate
else no menu
```

## Questions for Backend to Decide

- Final persistence design: normalized `MealMenuEntry` rows vs JSON grid.
- Exact uniqueness implementation for whole-campus `gradeLevelId = null` rows.
- Whether config belongs in existing campus settings or a dedicated model.
- Exact permission names and role seeding.
- Whether `PATCH /meal-menus/:id` replaces the whole grid or supports partial entry patching. Frontend is fine with whole-grid replace/upsert for v1.
- Whether to expose a dedicated copy endpoint or rely on client-composed copy via create.
- Exact filter encoding for whole-campus target (`gradeLevelId = null`) through the existing standard filter system.

## Acceptance Checklist for Backend Handoff Completion

- [ ] Backend has a spec/task set for meal-menu persistence and API.
- [ ] All required endpoints are documented with request/response DTOs.
- [ ] Campus scoping and grade-level ownership validation are covered.
- [ ] Whole-campus uniqueness is enforced for `gradeLevelId = null`.
- [ ] `GET /meal-menus` supports frontend list filters and returns entries.
- [ ] `GET/PUT /meal-menus/config` are available or an equivalent documented config surface exists.
- [ ] Error responses for duplicate/invalid grid cases are documented for frontend mapping.
- [ ] Backend response DTOs are treated as the source of truth before frontend implementation begins.
