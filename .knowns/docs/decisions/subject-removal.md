---
title: Subject Removal and ClassStaff Role Refactor — Decision
description: 'ADR capturing why the Subject domain was dropped entirely and ClassStaff was reshaped around a 3-value Vietnamese-kindergarten-appropriate role enum. Records the rationale, the consequences, when the subject concept conceptually returns (curriculum-domain tag on future learning features), and the enum values intentionally reserved for the deferred SPECIALIST and CARETAKER roles. Implementation spec lives at @doc/specs/subject-removal-classstaff-role-refactor.'
createdAt: '2026-05-23T15:29:26.726Z'
updatedAt: '2026-05-23T15:30:23.601Z'
tags:
  - decision
  - adr
  - class-management
  - staff
  - subject-removal
  - approved
---

# Subject Removal and ClassStaff Role Refactor — Decision

> **Status:** Accepted &nbsp;|&nbsp; **Date:** 2026-05-23 &nbsp;|&nbsp; **Driver:** Backend / CTO
>
> First entry in the `decisions/` folder. ADR-style record of *why* the `Subject` domain was removed and *why* ClassStaff was reshaped around a Vietnamese-kindergarten-appropriate role enum. Implementation lives at [@doc/specs/subject-removal-classstaff-role-refactor](specs/subject-removal-classstaff-role-refactor).

## Context

The pre-refactor schema modeled `ClassStaff` as a `(classId, staffId, subjectId)` composite — staff were assigned *per subject* per class, with `Subject` as a first-class reference-data entity (table, entity, repository port, Prisma mapper, repository implementation, `GetAllSubjectsUseCase`, and a `GET /reference-data/subjects` endpoint). This was a half-built model:

- **No consumer feature in the roadmap window** — neither the FE nor any backend feature actually read `subjectId`. `Subject` had a CRUD-style reference endpoint and that was it. No timetabling, no per-subject grade book, no lesson-plan attachment.
- **It was forcing the wrong staffing constraints** — kindergarten staff in Vietnamese day-care are not "the math teacher" and "the English teacher". The defining staffing question is *what role does this person play in this class* (homeroom teacher, assistant teacher, day-boarding teacher), not *which subject do they own*. The subject-keyed composite PK meant we could not even model "this is the homeroom teacher for class A1" without inventing a placeholder subject.
- **The composite PK leaked into every reference** — UoW ops, mappers, repository queries, and HTTP routes all carried the `subjectId` segment. Half of the surface had to either ignore it (passing dummy values) or work around it.

The cost of keeping `Subject` was real: code surface that did nothing, schema constraints that fought the actual product, and engineer hours every time someone hit the composite-PK awkwardness. The value of keeping it was zero — nothing depended on it.

## Decision

Drop `Subject` entirely and reshape `ClassStaff` for kindergarten-appropriate role tracking.

Concretely (see [spec D1–D11](specs/subject-removal-classstaff-role-refactor) for the locked decisions):

1. **Remove the `Subject` domain in full** — table, entity, repository port, Prisma mapper, Prisma repository, `GetAllSubjectsUseCase`, and the `GET /reference-data/subjects` endpoint. No half-state preserved. (D1)
2. **`ClassStaff` PK becomes `(classId, staffId)`** — one staff member holds one role per class. The composite drops the `subjectId` segment. (D2)
3. **Add `ClassStaffRole` enum** with three V1 values: `HOMEROOM`, `ASSISTANT`, `BOARDING`. Stored as a Prisma enum; surfaced through the domain layer; never any other source of truth. (D3)
4. **HOMEROOM is exactly one per class** — enforced at two layers: a domain-layer check inside `AssignStaffToClassUseCase` / `ChangeClassStaffRoleUseCase` (returns a clean `409 HOMEROOM_ALREADY_ASSIGNED`), and a Postgres partial unique index `class_staff_homeroom_unique ON class_staff(class_id) WHERE role = 'HOMEROOM'` as the structural backstop for races. (D5)
5. **Add `PATCH /classes/:classId/staff/:staffId`** for role changes. Avoids the audit gap of delete-then-recreate and matches the FE "change role" UX. (D9)
6. **All three staff mutations emit audit events** with role in `context` (and `previousRole` for change-role) — see [@doc/references/audit-event-context-shapes](references/audit-event-context-shapes) for the per-action shapes. (D10)

## Consequences

- **API is breaking; hard-cut, no deprecation window.** The HTTP surface for assign/remove and the new PATCH all change shape. The frontend team coordinates a synchronized release. (D6)
- **Pre-launch — no production data migration.** Dev `ClassStaff` rows backfill to `ASSISTANT` (safe default; dev users manually upgrade a few rows to HOMEROOM if needed). The migration drops the `subject` table and the `subjectId` column without preservation logic. (D8)
- **`Subject` knowledge is permanently gone from the code surface.** Any future feature that needs a curriculum/subject concept must rebuild the domain — there is no recoverable half-implementation to revive.
- **One staff per class, period.** The composite PK no longer allows "same person, multiple subject seats in the same class". This is the desired constraint, but it is a real product decision: if Vietnamese day-care ever does need multi-seat-per-staff modeling, that becomes a new schema change rather than a flag flip.
- **Partial unique index requires raw SQL.** Prisma can't model partial uniques declaratively, so the migration includes a raw `CREATE UNIQUE INDEX … WHERE role = 'HOMEROOM'` step. Document the SQL in the migration file so future migration squashes don't lose it. (D5)
- **Audit-trail wiring is mandatory on all three mutations** (assign, remove, change-role) — see [@doc/references/audit-event-context-shapes](references/audit-event-context-shapes) for the locked context shapes. Role-change emits both `previousRole` and `newRole`; no-op PATCH (same role) skips DB write *and* audit emission.

## Return path — when "subject" conceptually comes back

The model is gone, but the *concept* of curriculum/subject will resurface as a **curriculum-domain tag** attached to learning-flow features. Concretely, it returns when any of these ship:

- **Lesson plan** — a teacher writes a plan for a given class on a given day; the plan needs a curriculum tag (math / language / motor skills / art / music / EN as L2).
- **Daily report** — the per-day write-up parents see; entries against a curriculum tag let parents see "today's English / today's art".
- **Observation portfolio** — longitudinal evidence on a child's development organized by curriculum domain.
- **Report card** — termly summary, scored per curriculum domain.

When that work starts, the new domain model is **not** the old `Subject` reincarnated. It is a *tagging* concept (likely a `CurriculumDomain` enum or a small reference table owned by the lesson-plan / report-card feature, not by ClassStaff). Staff still attach to classes by role, not by subject; subject-style tagging attaches to learning-flow rows (plans, reports, observations, portfolios) — never back to the staffing axis.

The current refactor does not pre-build anything for this return path. The right shape only becomes clear once the consumer feature is in design.

## Deferred enum reservations

V1 ships with three role values: `HOMEROOM`, `ASSISTANT`, `BOARDING`. Two further role names are **reserved**:

| Reserved name | Vietnamese term | Meaning | When to promote |
|---|---|---|---|
| `SPECIALIST` | giáo viên năng khiếu | Music / English / art / motor-skills specialist — currently folded into `ASSISTANT` because no product feature filters by specialty yet | Promote to its own enum value the day a customer asks to filter or report by specialty (e.g. "show me classes that have a music teacher") |
| `CARETAKER` | bảo mẫu | Non-teaching hygiene / feeding role; explicitly **not** day-boarding teacher (that's `BOARDING`) | Promote when the FE needs to distinguish caretakers from teachers in staffing UI (e.g. a "non-teaching staff" filter, or a different default-permission set) |

**Do not reuse these names for anything else.** Specifically: `CARETAKER` is reserved for *bảo mẫu* (non-teaching hygiene/feeding); the day-boarding teacher role uses `BOARDING`, not `CARETAKER`. Mixing them up at the schema level later would require either a data migration or a renaming PR — both of which we avoid by reserving the names now.

The reservation is a soft constraint (just a comment in the enum file plus this ADR); it costs nothing to keep and saves a debate when the role is actually promoted.

## Vietnamese ↔ English role label mapping

The DB stores English enum strings; the UI renders per-locale labels. Backend never produces the Vietnamese label — it lives in the FE i18n bundle. (D7)

| Enum value | Vietnamese (`vi`) | English (`en`) |
|---|---|---|
| `HOMEROOM` | Giáo viên chủ nhiệm | Homeroom teacher |
| `ASSISTANT` | Giáo viên phụ | Assistant teacher |
| `BOARDING` | Giáo viên bán trú | Day-boarding teacher |

Mnemonics for translators:

- **Chủ nhiệm** = "in charge of" — owner / accountable lead for the class. Maps cleanly to `HOMEROOM`.
- **Phụ** = "auxiliary / supporting" — the secondary teacher. Maps to `ASSISTANT`.
- **Bán trú** = "day-boarding" (literally "half-stay") — the staff who run the afternoon nap / lunch / nap-pickup window for kids who stay full-day. Maps to `BOARDING`.

## References

- Implementation spec — [@doc/specs/subject-removal-classstaff-role-refactor](specs/subject-removal-classstaff-role-refactor) (locked decisions D1–D11, functional + non-functional requirements, acceptance criteria, scenarios)
- Audit event shapes — [@doc/references/audit-event-context-shapes](references/audit-event-context-shapes) (per-action `context` payloads for the three staff actions)
- Multi-campus scoping guarantees — [@doc/guides/working-with-campuses](guides/working-with-campuses) (all three mutations preserve `@CampusContext()`)
