---
title: Care Instructions Removal Impact Research
description: Backend impact map and specification guidance for completely removing the StudentHealthInstruction aggregate, endpoints, daily read-model fields, and persistence while preserving medication directions and audit history.
createdAt: '2026-07-16T21:00:01.300Z'
updatedAt: '2026-07-16T21:00:19.564Z'
tags:
  - research
  - backend
  - student-health
  - care-instructions
  - removal
  - migration
---

# Care Instructions Removal Impact Research

## Result

Care Instructions is a complete backend aggregate named `StudentHealthInstruction`, not a label over Health Events or medication directions. Complete removal spans PostgreSQL/Prisma persistence, domain enums/entity, application ports/use cases, Prisma mapper/repository, seven HTTP endpoints, DTOs/OpenAPI, StudentHealthModule wiring, Health Center daily aggregation, seed fixtures, audit vocabulary, exports, and tests.

Medication request/administration item fields named `instructions` are a separate caregiver medication-directions contract and must remain.

## Persistence Footprint

`prisma/schema.prisma` contains:

- `StudentHealthInstructionType`
- `StudentHealthInstruction`
- Campus, Student, and User relations
- active/archive/Health Center lookup indexes and actor indexes

The original table/type were introduced by `prisma/migrations/20260701023000_add_student_health_foundation/migration.sql`; archive metadata/indexes were added by `20260714171000_add_student_health_archive_metadata`.

No other domain table has an inbound foreign key to `student_health_instruction`. The table owns foreign keys to Campus, Student, and User, so it can be dropped without converting or cascading medication/event/checkup records.

Recommended development-phase final state:

1. Add a new forward migration; never rewrite historical migrations.
2. Run a preflight row count and optional export if any non-seed data matters.
3. Drop `student_health_instruction`, then drop `StudentHealthInstructionType`.
4. Remove Prisma relations/model/enum and regenerate Prisma.
5. Do not convert instruction rows into medication requests or Health Events: their authorship, consent, lifecycle, and temporal semantics differ.

The repository already has a dev-only hard-cutover precedent in `20260523032535_subject_removal_classstaff_role_refactor/migration.sql`: transactional, guarded drops, explicit sequencing, and documented irreversible data loss.

## API Surface

Remove these seven instruction endpoints:

1. `GET /students/:studentId/health-instructions`
2. `POST /students/:studentId/health-instructions`
3. `GET /students/:studentId/health-instructions/active`
4. `GET /students/:studentId/health-instructions/:instructionId`
5. `PATCH /students/:studentId/health-instructions/:instructionId`
6. `DELETE /students/:studentId/health-instructions/:instructionId`
7. `GET /classes/:classId/health-instructions/active`

The six student endpoints live in `src/infra/http/controllers/student-health.controller.ts`; the class endpoint and controller live in `class-health-instructions.controller.ts`. After removal, unmatched routes should return the ordinary route-level 404. No tombstone endpoint is needed for the development hard cutover.

Delete instruction request/query/response DTOs and their exports. OpenAPI then stops advertising the endpoints and models.

## Clean Architecture Layers

Remove instruction-only code and barrel exports from:

- `src/domain/student-health/entities/student-health-instruction.entity.ts`
- `src/domain/student-health/enums/student-health-instruction-type.enum.ts`
- `src/domain/student-health/enums/student-health-instruction-status.enum.ts`
- `src/application/student-health/ports/student-health-instruction.repository.ts`
- create, update, archive, list, active-student, active-class, and detail instruction use cases
- `src/infra/persistence/prisma/mapper/prisma-student-health-instruction.mapper.ts`
- `src/infra/persistence/prisma/repositories/prisma-student-health-instruction.repository.ts`
- `src/infra/http/controllers/class-health-instructions.controller.ts`
- instruction DTO files under `src/infra/http/dtos/student-health`

`src/infra/http/modules/student-health.module.ts` must remove the class controller, instruction use cases, Prisma repository provider/token, and exported repository token. Preserve profile, checkup, event, Health Center, and medication-history wiring.

Important coupling: `GetHealthCenterDailyItemsUseCase` imports `parseReferenceDate` from `get-active-student-health-instructions.use-case.ts`. Move that reusable date parser into a neutral student-health/core date utility or make the daily use case own it before deleting instruction use cases.

## Health Center Contract

The final `GET /health-center/daily-items` contract should remove:

- query: `instructionsOffset`, `instructionsLimit`
- response: top-level `instructions`
- response: `pagination.instructions`
- response: `counts.instructions`
- the instruction repository dependency and instruction query/count promises
- `HealthCenterInstructionResponseItem` and instruction response DTO

Keep:

- `access.healthItems` for Health Event visibility under `student_health.read`
- `counts.events`
- `counts.total`, redefined as the health-only event total
- `counts.visibleTotal = events + medicationAdministrations`
- `counts.actionRequired` unchanged, because Care Instructions never contributed to it
- event and medication pagination/arrays, class/date validation, permission-aware non-invocation, summaryOnly, campus-timezone behavior, and request-review counts

Medication queue DTO `instructions` remains untouched.

## Permissions and Audit

There is no instruction-specific RBAC permission. Keep `student_health.read/create/update/delete` because profiles, checkups, and events use them. No role/permission migration is required. The Health Center OR-entry permission also remains unchanged.

Instruction writes currently emit:

- `CREATE_STUDENT_HEALTH_INSTRUCTION`
- `UPDATE_STUDENT_HEALTH_INSTRUCTION`
- `ARCHIVE_STUDENT_HEALTH_INSTRUCTION`

Stop producing these actions when endpoints/use cases are removed, but preserve existing append-only `AuditEvent` rows and retain the three codes as deprecated historical vocabulary in `audit-action.enum.ts`, `action-visibility.ts`, and `generated/audit-actions.json`.

Also retain `student_health_instruction` as a historical audit target type. Audit rows intentionally store bare target UUIDs and write-time context so they survive entity deletion. After the Prisma model is removed, change the audit recorder resolver case so it returns `targetName: null` rather than querying `tx.studentHealthInstruction`; older rows remain readable through their stored context instead of becoming unknown actions.

Do not delete instruction audit events as part of the table migration.

## Seeds, Tests, and Documentation

Remove the instruction IDs, upserts, and endpoint hint from `prisma/seeds/seed-health-center.ts`. Keep the seed command because it still creates profiles, checkups, events, staff, and class data.

Delete instruction-only unit/repository/mapper/DTO suites. At least thirteen existing test files directly exercise instruction behavior. Update:

- student-health controller route metadata and class-controller tests
- StudentHealthModule provider/controller coverage
- Health Center use-case tests/mocks/concurrency assertions
- daily-items query/response DTO serialization tests
- archive mapper/repository tests that parameterize checkup/instruction/event
- audit-recorder Prisma mocks and resolver behavior
- Prisma migration/schema assertions

Required negative coverage:

- Prisma schema contains no instruction model/enum/relations.
- The new migration drops the table before the enum, uses no `CASCADE`, and leaves `audit_event` untouched.
- All seven routes are absent from controller/OpenAPI metadata.
- Obsolete instruction pagination query keys return 400 under the existing non-whitelisted-property validation policy.
- Health Center never invokes an instruction repository and returns no instruction fields.
- `counts.total`, `visibleTotal`, `actionRequired`, and `summaryOnly` follow final semantics.
- No instruction repository/provider token remains.
- Medication item `instructions` still round-trip.
- No `student_health.*` permission is deleted.

OpenAPI is decorator-generated; there is no checked-in artifact to delete.

## Rollout and Dirty-Tree Risk

The current frontend dereferences instruction pagination, so backend-first wire removal can crash old clients. Final specs may define a clean breaking contract while deployment uses either:

1. frontend removal against the old additive backend, then browser-session drain/refresh, then backend removal and schema migration; or
2. one atomic development deployment with no surviving old clients.

Do not deploy the destructive migration while old backend instances can still query the table.

The backend working tree contains the previous health/lifecycle implementation and migrations as a large uncommitted wave. Commit or isolate that baseline before implementing removal; otherwise deleted code cannot be distinguished safely from never-committed prerequisite work.

## Documentation Impact

The new backend removal spec should supersede only instruction portions of:

- @doc/specs/2026-07-14/student-health-and-medication-lifecycle-backend
- @doc/specs/2026-07-14/health-unified-flow-backend
- @doc/backend-handoff/student-health-and-medication-lifecycle-backend-handoff
- @doc/backend-handoff/health-unified-flow-backend-handoff

Keep completed tasks and archived Health Center research as historical evidence. Publish a new backend handoff after implementation for the frontend removal spec.

## Recommended Decisions

1. Hard-remove `StudentHealthInstruction` through a forward migration after a preflight/export decision.
2. Preserve medication directions and all remaining student-health domains.
3. Remove all seven endpoints and all instruction-specific clean-architecture layers.
4. Remove instruction fields/params from daily-items; retain `counts.total` as event total.
5. Keep `student_health.*` permissions.
6. Preserve append-only audit rows and keep retired audit labels when needed.
7. Frontend-first or atomic rollout; never backend-first with old clients/instances.
