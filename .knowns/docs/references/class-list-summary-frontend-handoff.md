---
title: Class List Summary Frontend Handoff
description: 'Frontend request: backend contract changes needed before the frontend can add student-count + staff-avatar columns to the class list page. Specifies the wire shape, semantics, and existing precedents to mirror; lets the backend dev author their own spec/plan from here.'
createdAt: '2026-05-26T02:14:25.959Z'
updatedAt: '2026-05-26T02:14:25.959Z'
tags:
  - reference
  - handoff
  - frontend
  - class-management
  - class-list
---

## Purpose

The frontend wants to add two new columns to the **class list page** (`/dashboard/classes`):

1. **Student count** — number of currently-enrolled students per class.
2. **Staff preview** — an `AvatarGroup` of assigned staff, with each avatar showing the staff's name on hover.

Today, `GET /classes` returns enough for the existing two columns (name + grade-level pill) but nothing for these. This brief enumerates what's already in place, what the backend needs to ship, the exact wire contract, and the existing precedents to mirror.

Audience: backend dev. Once the contract below lands, the frontend will spec/plan/implement the two columns in `classes-data-table.tsx`.

---

## What backend ALREADY ships (no changes needed)

| Capability | Endpoint | Notes |
|---|---|---|
| Paginated class list | `GET /classes` | StandardRequest filters: `name`, `description`, `gradeLevelId`, `schoolYearId`. Sorts: `createdAt`, `updatedAt`, `name`. Response is `ClassResponse[]` with `gradeLevel` + `schoolYear` includes. |
| Active enrollments per class | `GET /classes/:id/enrollments` | Used today by the class **profile** page to compute the hero's "Active students" stat client-side via `.length`. Not suitable for the list page (would require N round trips). |
| Staff per class | `GET /classes/:id/staff` | Returns `ClassStaffResponse[]` with `{ classId, staffId, role, staff: { id, fullName, email, staffType } }`. Not suitable for the list page for the same reason. |

### DB shape (already migrated)

- `enrollment` has `endDate`/`exitReason` columns. Active = `endDate IS NULL`. Partial unique index `idx_enrollment_one_active_per_student` enforces at most one active enrollment per student.
- `class_staff` is `(classId, staffId)`-keyed with a `role` enum: `HOMEROOM` / `ASSISTANT` / `BOARDING`. Partial unique index enforces at most one `HOMEROOM` per class.
- `staff` has **no `avatarUrl` field**. The existing class-profile staff tab confirms this — it renders `<AvatarImage src={undefined}>` and always falls back to initials. **No image URL is needed in the new payload.**

---

## What backend NEEDS to add

### Extend `GET /classes` response

Add two fields to each row in the existing list endpoint. Keep the existing pagination / filtering / sorting unchanged.

```ts
// New DTOs
class ClassStaffPreview {
  id: string;              // staff.id
  fullName: string;        // staff.fullName
  role: ClassStaffRole;    // HOMEROOM | ASSISTANT | BOARDING
}

class ClassListItemResponse extends ClassResponse {
  studentCount: number;          // count of active enrollments (endDate IS NULL)
  staff: ClassStaffPreview[];    // all rows, ordered (see below)
}
```

The controller's `@StandardResponse({ type: ClassResponse, isArray: true })` becomes `type: ClassListItemResponse`.

### Semantics

- **`studentCount`** counts `Enrollment` rows where `classId = class.id AND endDate IS NULL`. Mirrors the "Active students" stat semantic used by `ClassProfileHero` so the list and the profile agree.
- **`staff[]`** returns the **full set** for the class — bounded by enum (1×HOMEROOM + a few ASSISTANT + a few BOARDING). No need to paginate or truncate; the frontend will handle visual overflow via `AvatarGroupCount`.
- Suggested ordering: `role` ascending then `createdAt` ascending. The frontend's spec will probably want HOMEROOM rendered leftmost in the AvatarGroup.

### Out of scope (do NOT do)

- **Don't** add `studentCount` to the filter or sort allow-lists. Per the project convention "derived fields are display-only," operator filtering happens via real columns; the count is render-only.
- **Don't** plumb an `avatarUrl` field through — Staff doesn't have one and the frontend convention is initials-only fallback.
- **Don't** introduce a separate `GET /classes/summary` endpoint. Extending the existing list response keeps one cache, one query key, and one filtering surface on the frontend.

---

## Suggested implementation hints

These are hints, not prescriptions — feel free to spec your own approach.

### Mirror the SYE `_count` precedent

`PrismaSchoolYearEnrollmentRepository.findAllByStudentIdWithChildCount` (file: `infra/persistence/prisma/repositories/prisma-school-year-enrollment.repository.ts:56-75`) is the established pattern for carrying aggregate data out of the repo without polluting the domain entity. It returns a tuple shape:

```ts
return rows.map((row) => ({
  enrollment: PrismaSchoolYearEnrollmentMapper.toDomain(row),
  childEnrollmentCount: row._count.enrollments,
}));
```

Apply the same shape to `PrismaClassRepository.findAll`:

```ts
include: {
  gradeLevel: true,
  schoolYear: true,
  _count: { select: { enrollments: { where: { endDate: null } } } },
  staff: {
    include: { staff: { select: { id: true, fullName: true } } },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  },
},
```

Then return `Array<{ class: Class; studentCount: number; staff: ClassStaffPreview[] }>` and let `GetAllClassesUseCase` (or a tiny mapper in the controller layer) assemble `ClassListItemResponse`. Keep the `Class` domain entity pristine.

### Pagination wrapper

`PrismaQueryService.executeQuery` (`core/modules/standard-response/services/prisma-query.service.ts`) maps Prisma rows through a `MapperClass.toDomain` at the end. Two ways to thread the extras through:

1. Have `findAll` bypass `executeQuery` (or accept a richer mapper that returns the tuple). Less magic; one more place to maintain pagination math.
2. Keep `executeQuery` and shape the tuple inside a domain → DTO mapper in the use-case. Simpler.

Either is fine — pick the one that fits your domain-layering preference.

---

## Test scenarios (suggested)

1. **Empty class** → `studentCount: 0`, `staff: []`.
2. **Mixed active + closed enrollments** → `studentCount` includes only `endDate IS NULL` rows; transferred/withdrawn rows excluded.
3. **All three roles assigned** → `staff[]` includes all rows; HOMEROOM appears first by suggested ordering.
4. **No HOMEROOM** → `staff[]` is non-empty but contains no HOMEROOM row (the frontend will accept this).
5. **Pagination + filter regression** → existing `?limit`, `?offset`, `filter[gradeLevelId][eq]=`, `filter[schoolYearId][eq]=` still work and `studentCount` reflects the underlying class regardless of paging.
6. **Campus scoping** → cross-campus class is invisible (existing campus guard already enforces this; do not regress).

---

## References (existing files to mirror)

- `infra/persistence/prisma/repositories/prisma-school-year-enrollment.repository.ts:56-75` — `_count` with tuple return; the canonical "aggregate alongside domain" pattern.
- `infra/persistence/prisma/repositories/prisma-class.repository.ts:117-142` — current `findAll` to extend.
- `infra/http/dtos/class-management/class.response.ts` — where `ClassResponse` lives; add `ClassListItemResponse` next to it.
- `infra/http/dtos/class-management/class-staff.response.ts` — shape of `ClassStaffStaffInfo`; the new `ClassStaffPreview` is a strict subset of that.
- `infra/http/controllers/class-management/class.controller.ts:143-151` — the `findAll` controller method whose `@StandardResponse` type swaps to the new DTO.
- `application/class-management/use-cases/class/get-all-classes.use-case.ts` — where to assemble the list-flavored DTO.

---

## Order of operations

1. Add `ClassStaffPreview` + `ClassListItemResponse` DTOs.
2. Extend `PrismaClassRepository.findAll` to include `_count` + `staff` and return the tuple shape.
3. Update `GetAllClassesUseCase` (or controller mapper) to assemble `ClassListItemResponse[]`.
4. Swap the controller's `@StandardResponse` type to `ClassListItemResponse`.
5. Tests per the scenarios above.

---

## Frontend plan once backend ships

1. Mirror the new types in `src/features/classes/types.ts` (`ClassStaffPreview`, `ClassListItem extends ClassWithDetails`).
2. Update `classService.getAll`'s generic to the new list type.
3. Add `studentCount` and `staff` columns to `src/features/classes/components/classes-data-table.tsx`. The staff column will use the existing `<AvatarGroup>` / `<AvatarGroupCount>` (`src/components/ui/avatar.tsx`) wrapped with `<Tooltip>` (`src/components/ui/tooltip.tsx`) — no new UI primitives needed.
4. No changes to mutation / invalidation logic — the existing `classKeys.list(...)` cache covers the new fields automatically.
