---
id: k6vdnz
title: 'feat(user-management): add campus-scoped staff code (ST-YYYY-XXXXXX) + enforce code immutability'
status: done
priority: medium
labels:
  - user-management
  - staff
  - code-generation
  - clean-architecture
createdAt: '2026-04-21T16:37:12.557Z'
updatedAt: '2026-04-21T17:19:19.477Z'
timeSpent: 2507
assignee: '@me'
---
# feat(user-management): add campus-scoped staff code (ST-YYYY-XXXXXX) + enforce code immutability

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an auto-generated, campus-scoped, immutable staff code mirroring the student code pattern, but with a hard-coded `ST-` prefix (format `ST-YYYY-XXXXXX`). Also align student code to be immutable (currently mutable in its mapper).

**Scope constraints (from user):**
- DB is empty — no data migration / backfill needed.
- `ST-` prefix is hard-coded in the staff generator service (no generic prefix parameter / abstraction).
- Staff code is immutable (no setter, no update path).
- Student code immutability enforced in the same task for consistency.
- Extend the existing doc at @doc/guides/code-generation-pattern — do not create a new doc.

**Pattern reference:** mirrors `StudentCodeGeneratorPort` / `StudentCodeGeneratorService` / `StudentCodeSequence` (composite PK `campusId_year`, atomic upsert + increment, max 999,999 / campus / year).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Prisma schema: `StaffCodeSequence` model added (composite PK `campusId_year`, FK→Campus onDelete Restrict) + `Staff.staffCode String` field + `@@unique([campusId, staffCode])` + Campus back-relation `staffCodeSequences`
- [x] #2 Prisma migration generated and applied cleanly (no drift)
- [x] #3 Application port: `StaffCodeGeneratorPort` abstract class with `generateNextCode(campusId): Promise<string>` in `src/application/ports/`
- [x] #4 Infra service: `StaffCodeGeneratorService` extends port, hard-coded `ST-` prefix, format `ST-${YYYY}-${XXXXXX}`, atomic upsert, throws `ConflictException` above 999,999
- [x] #5 Staff entity: `staffCode` required in `StaffProps`, validated in `Staff.create()`, no getter-setter / `updateProfile` / `changeStaffCode` path (immutable)
- [x] #6 Prisma staff mapper: `staffCode` included in `toDomain` + `toPrisma` (create), EXCLUDED from `toPrismaUpdate`
- [x] #7 Prisma student mapper: `studentCode` removed from `toPrismaUpdate` (immutability alignment)
- [x] #8 `CreateStaffUseCase` injects `StaffCodeGeneratorPort` and generates code before `Staff.create()` within the existing saga flow (compensates Clerk on failure)
- [x] #9 `StaffResponse` DTO exposes `staffCode` with `@ApiProperty`
- [x] #10 `user-management.module.ts` registers `{ provide: StaffCodeGeneratorPort, useClass: StaffCodeGeneratorService }`
- [x] #11 Unit tests: `staff-code-generator.service.spec.ts` mirroring student tests (format, campus isolation, year rollover, limit)
- [x] #12 Doc extended: `@doc/guides/code-generation-pattern` covers staff (prefix, composite PK, immutability rule), and `StudentCodeSequence` block is refreshed to match current multi-campus schema
- [x] #13 `npm run lint`, `npm run build`, and `npm test` all pass for affected scope
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan — Staff Code (ST-YYYY-XXXXXX) + Code Immutability

**Reference pattern:** mirrors student code generator; see @doc/guides/code-generation-pattern.

### 1. Prisma schema (`prisma/schema.prisma`)
- Add `StaffCodeSequence` model mirroring `StudentCodeSequence`:
  - Composite PK `@@id([campusId, year])`, `lastNumber Int @default(0)`, `updatedAt`, FK → Campus `onDelete: Restrict`, `@@map("staff_code_sequence")`.
- Add back-relation on `Campus`: `staffCodeSequences StaffCodeSequence[]`.
- Add `staffCode String @map("staff_code")` on `Staff` model.
- Add `@@unique([campusId, staffCode])` on `Staff`.
- Run `npx prisma migrate dev --name add_staff_code` (DB is empty — no backfill needed).

### 2. Application port
- New file `src/application/ports/staff-code-generator.port.ts`:
  - `abstract class StaffCodeGeneratorPort { abstract generateNextCode(campusId: string): Promise<string>; }`
  - Doc comment notes `ST-` prefix + `YYYY-XXXXXX` suffix.

### 3. Infra service
- New file `src/infra/persistence/prisma/services/staff-code-generator.service.ts`:
  - Extends `StaffCodeGeneratorPort`, injects `PrismaService`.
  - Hard-coded prefix: ``return `ST-${currentYear}-${paddedSequence}`;``
  - Atomic upsert on `staffCodeSequence` using `campusId_year` composite key.
  - `MAX_SEQUENCE_NUMBER = 999999`, throws `ConflictException` when exceeded.
- New file `src/infra/persistence/prisma/services/staff-code-generator.service.spec.ts` mirroring `student-code-generator.service.spec.ts` (format check including `ST-` prefix, campus isolation, year rollover, limit).

### 4. Domain: immutable `staffCode`
- `src/domain/user-management/entities/staff.entity.ts`:
  - Add `staffCode: string` to `StaffProps` (required).
  - Add `get staffCode(): string` getter.
  - Validate in `Staff.create()` (non-empty, matches `/^ST-\d{4}-\d{6}$/`).
  - Do **not** add to `UpdateStaffData`, `updateProfile`, or any setter — immutability enforced by absence.
  - Update factory signature `Optional<StaffProps, ...>` — `staffCode` stays required (callers must generate first).
- Update `staff.entity.spec.ts`: add creation test for valid/invalid `staffCode`; verify no update path mutates it.

### 5. Infra mapper (`prisma-staff.mapper.ts`)
- `toDomain` / `toDomainSimple`: include `staffCode: prismaStaff.staffCode`.
- `toPrisma` (create): include `staffCode: staff.staffCode`.
- `toPrismaUpdate`: **exclude** `staffCode` entirely (immutability contract).

### 6. Student mapper immutability alignment
- `src/infra/persistence/prisma/mapper/prisma-student.mapper.ts`:
  - Remove `studentCode: student.studentCode` from `toPrismaUpdate` (matches staff contract; prevents accidental mutation).
- Sanity-check `student.entity.ts` has no `updateProfile`/setter that touches `studentCode` — leave entity alone if already immutable.

### 7. Use-case wiring (`CreateStaffUseCase`)
- Inject `StaffCodeGeneratorPort` via constructor (follow `CreateStudentUseCase` pattern).
- Generate `staffCode` **inside** the existing saga — after Clerk provisioning and uniqueness checks, before `Staff.create()`.
- Pass `staffCode` into `Staff.create()` and `tx.createStaff({...})`.
- If DB txn fails, existing Clerk compensation already runs — no change to saga shape.

### 8. HTTP response DTO (`staff.response.ts`)
- Add `staffCode: string` with `@Expose()` + `@ApiProperty({ example: "ST-2025-000001" })`.

### 9. Module wiring (`src/infra/http/modules/user-management.module.ts`)
- Add provider binding `{ provide: StaffCodeGeneratorPort, useClass: StaffCodeGeneratorService }` next to the student one.

### 10. Doc update — extend @doc/guides/code-generation-pattern
- Refresh the `StudentCodeSequence` block to show the current multi-campus schema (composite PK `campusId_year`, campus FK).
- Add a "Staff Code" section: format `ST-YYYY-XXXXXX`, hard-coded prefix, example values, same race-condition + sequence-exhaustion behavior.
- Add an "Immutability" section: both student and staff codes are immutable; mappers deliberately exclude them from `toPrismaUpdate`; no entity setter exists.
- Update "Creating Similar Generators" to note prefix-vs-no-prefix as a per-generator design choice (YAGNI: hard-code the prefix inside the service).

### 11. Validate
- `npm run lint`.
- `npm run build`.
- `npm test -- staff-code-generator staff.entity staff create-staff prisma-staff prisma-student` (scoped suites).

### Key assumptions
- `prisma-staff.mapper.ts.toPrismaUpdate` stays on `Prisma.StaffUpdateInput` (no FK fields changed) — no need to switch to `Unchecked` per the mapper memory.
- No seeds / sync-sequence script exists yet for staff; skipped (empty DB). If seeds appear later, follow the student `sync-sequence.ts` template.
- Existing `UpdateStaffUseCase` already does not touch `staffCode` (field doesn't exist yet) — no update-path change needed.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Step 1 done: Prisma schema updated (StaffCodeSequence model + Staff.staffCode + @@unique([campusId, staffCode]) + Campus back-relation). Migration 20260421170000_add_staff_code applied. Client regeneration deferred (dev server holding DLL).
Implementation complete.

**Step 2 (Port):** `src/application/ports/staff-code-generator.port.ts` — abstract class with `generateNextCode(campusId): Promise<string>`.

**Step 3 (Service):** `src/infra/persistence/prisma/services/staff-code-generator.service.ts` — hard-coded `STAFF_CODE_PREFIX = "ST-"`, atomic upsert on `staffCodeSequence` composite PK `campusId_year`, throws `ConflictException` above 999,999. Logic-level spec at `staff-code-generator.service.spec.ts` mirrors the student one (format, padding, limit, campus isolation, year rollover).

**Step 4 (Entity):** `staff.entity.ts` — added `staffCode: string` to `StaffProps`, read-only getter, `STAFF_CODE_PATTERN = /^ST-\d{4}-\d{6}$/` validated in `create()`, and excluded from `UpdateStaffData` via `Omit`. Spec updated: added `validStaffCode`, three new test cases (missing / invalid / accept valid), plus `staffCode: validStaffCode` threaded through every existing `Staff.create({...})` call. Also updated `entity-creation-with-campus.spec.ts` and `assign-staff-to-class.use-case.spec.ts`.

**Step 5 (Staff mapper):** `staffCode` included in `toDomain`, `toDomainSimple`, `toPrisma` (create); intentionally omitted from `toPrismaUpdate` with inline comment.

**Step 6 (Student mapper immutability):** `studentCode` removed from `toPrismaUpdate` — both codes now immutable at the mapper layer.

**Step 7 (Use case):** `CreateStaffUseCase` injects `StaffCodeGeneratorPort`, calls `generateNextCode(input.campusId)` inside the saga (after Clerk provisioning, before `Staff.create`), passes `staffCode` through the entity and `tx.createStaff(...)`. Also added `staffCode: string` to `UnitOfWorkPort.createStaff` data shape and to `StaffTransactionOps.createStaff` — deliberately NOT added to the update shape so immutability is enforced at four layers (entity type, factory validation, mapper, UoW port).

**Step 8 (DTO):** `StaffResponse` exposes `staffCode` with `@ApiProperty({ example: "ST-2025-000001", description: "Campus-scoped, immutable staff code in format ST-YYYY-XXXXXX" })`.

**Step 9 (Module):** `user-management.module.ts` registers `{ provide: StaffCodeGeneratorPort, useClass: StaffCodeGeneratorService }`. `entity-factories.ts` also updated to generate a valid `ST-YYYY-XXXXXX` default.

**Step 10 (Doc):** `guides/code-generation-pattern` rewritten to cover both generators — refreshed `StudentCodeSequence` to the multi-campus composite-PK schema, added Staff Code section with prefix rationale, added Ports section, added Immutability section listing all four enforcement layers, updated "Creating Similar Generators" to include prefix-vs-no-prefix design choice and campus scoping.

**Step 11 (Validation):**
- `npx prisma generate`: OK.
- Targeted tests (`staff|student-code|entity-creation-with-campus`): 157/157 pass.
- Full `npm test`: 493/493 pass across 31 suites.
- `npm run build`: clean.
- `npm run lint` on touched files: 0 errors (the 39 errors in the repo-wide lint are all pre-existing unused-import issues in files I didn't touch).
- `knowns validate k6vdnz`: 0 errors, 0 warnings.

**SOLID / Clean Architecture adherence:**
- SRP: each class has one reason to change (generator = code strings, port = contract, entity = staff invariants, mapper = row ↔ entity translation).
- OCP: adding a new code type means adding a new port/service pair without touching existing ones.
- LSP/ISP: `StaffCodeGeneratorPort` exposes exactly one method; `StaffCodeGeneratorService` extends it faithfully.
- DIP: `CreateStaffUseCase` depends on the abstract port, not the Prisma-aware service — wiring is done in the NestJS module.
- Clean Architecture layering preserved: Domain → Application (Ports) ← Infrastructure; HTTP layer depends inward; port lives in the application layer, adapter lives in infra, domain knows nothing about Prisma.
<!-- SECTION:NOTES:END -->

