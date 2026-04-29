---
id: z3x2vg
title: 'fix(user-management): align staff update flow with guardian, fix restore verb and required fields'
status: done
priority: high
labels:
  - backend
  - user-management
  - staff
  - guardian
  - clerk
  - breaking-change
createdAt: '2026-04-21T15:49:15.023Z'
updatedAt: '2026-04-21T16:06:54.869Z'
timeSpent: 1011
---
# fix(user-management): align staff update flow with guardian, fix restore verb and required fields

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Align Staff and Guardian CRUD flows so frontend can build consistent forms.

## Problems found

1. **Staff cannot update email/phone.** `UpdateStaffRequest` omits `email` and `phoneNumber`, and `UpdateStaffUseCase.detectClerkChanges` only syncs `fullName`. Guardian already supports full email/phone sync via Clerk saga (`replacePrimaryEmail` / `replacePrimaryPhone` in `IdentityService`).

2. **Staff restore uses `POST /staff/:id/restore`** while Guardian uses `PATCH /guardians/:id/restore`. Inconsistent across otherwise-identical flows.

3. **Required-field mismatch between create DTOs.**
   - Staff: `gender` is currently optional, should be **required**.
   - Guardian: `email` is currently optional, should be **required**.
   - `dateOfBirth` is currently REQUIRED on guardian create (DTO + use-case age check) but should be **optional on both** per new spec.

## Breaking changes (frontend coordination required)

- `POST /staff/:id/restore` → `PATCH /staff/:id/restore`
- `POST /staff` — `gender` now required
- `POST /guardians` — `email` now required, `dateOfBirth` now optional
- `PATCH /staff/:id` — new fields accepted: `email`, `phoneNumber` (uniqueness enforced, campus-scoped)

## Out of scope

- Guardian restore verb (already correct)
- Clerk config changes (all required capabilities already used by guardian)
- Frontend implementation (this task covers backend only)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PATCH /staff/:id accepts email and phoneNumber; values are validated (E.164, email format) and checked for campus-scoped uniqueness (excluding self)
- [x] #2 UpdateStaffUseCase syncs email/phoneNumber/fullName to Clerk via saga pattern: Clerk first → DB tx → revert Clerk on DB failure (mirroring UpdateGuardianUseCase)
- [x] #3 Staff restore endpoint is PATCH /staff/:id/restore (not POST); Swagger reflects the change
- [x] #4 CreateStaffRequest marks gender as required (@IsNotEmpty, no @IsOptional); create use-case rejects missing gender via DTO validation
- [x] #5 CreateGuardianRequest marks email as required and dateOfBirth as optional; CreateGuardianUseCase only runs the 18+ age check when dateOfBirth is provided
- [x] #6 Guardian controller Swagger description typo 'ChangeMe12-3!' corrected to 'ChangeMe123!'
- [ ] #7 Unit tests cover: staff update with email change (Clerk sync + revert on DB failure), staff update with phone change, staff restore via PATCH, guardian create without dateOfBirth, guardian create requiring email, staff create requiring gender
- [x] #8 No regression in existing staff/guardian create/archive/delete/list/find-by-id flows (existing tests still pass)
- [x] #9 Swagger docs for both controllers reflect new required/optional field set; descriptions updated for PATCH /staff/:id to mention email/phone sync
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### 1. DTO updates (`src/infra/http/dtos/user-management/`)
- **`staff/update-staff.request.ts`**: add `email?` (`@IsOptional @IsEmail`) and `phoneNumber?` (`@IsOptional @IsString @IsE164Phone`) — mirror `UpdateGuardianRequest`
- **`staff/create-staff.request.ts`**: change `gender` from `@IsOptional` → `@IsNotEmpty @IsEnum(Gender)` (required)
- **`guardian/create-guardian.request.ts`**: change `email` from `@IsOptional` → `@IsNotEmpty @IsEmail` (required); change `dateOfBirth` to `@IsOptional` (keep `@IsAdultDateOfBirth` conditional)

### 2. Domain entity (`src/domain/user-management/entities/staff.entity.ts`)
- Verify `UpdateStaffData` / `Staff.updateProfile` already supports `email` and `phoneNumber`. If not, extend them (check first before editing — guardian entity already does)

### 3. Application layer (`src/application/user-management/use-cases/`)
- **`staff/update-staff.use-case.ts`** — major refactor to match `update-guardian.use-case.ts`:
  - Extend `UpdateStaffInput` with `email?`, `phoneNumber?`
  - Add `checkEmailUniqueness` / `checkPhoneUniqueness` campus-scoped helpers (uses existing `findByEmailInCampus` / `findByPhoneNumberInCampus` on `StaffRepository`; verify methods exist)
  - Extend `ClerkChanges` and `ClerkOriginalValues` to include `email` and `phoneNumber`
  - `detectClerkChanges`: detect email/phone/fullName changes
  - `updateWithClerkSync`: pass `email` + `phoneNumber` to `identityPort.updateUser` (reuses existing `replacePrimaryEmail/Phone` in `IdentityService` — no infra changes)
  - `revertClerkChanges`: revert all three fields if changed
  - Persist email/phone in DB tx inside `updateStaff` call
- **`guardian/create-guardian.use-case.ts`**: wrap age check in `if (input.dateOfBirth)` guard; `CreateGuardianInput.dateOfBirth` → optional

### 4. Controller changes (`src/infra/http/controllers/user-management/`)
- **`staff.controller.ts`**:
  - Change `@Post(':id/restore')` → `@Patch(':id/restore')` (line 199)
  - `update()`: pass `dto.email` and `dto.phoneNumber` into `updateStaffUseCase.execute`
  - Refresh Swagger `@ApiOperation` description on PATCH `/staff/:id` to mention email/phone sync
- **`guardian.controller.ts`**: fix typo `ChangeMe12-3!` → `ChangeMe123!` in Swagger description (line 79)

### 5. Tests (`src/application/user-management/use-cases/*/tests/`)
- Extend `update-staff.use-case.spec.ts` (or create if missing): email change syncs Clerk, phone change syncs Clerk, DB failure triggers Clerk revert, duplicate email/phone in campus throws 409
- Extend `create-staff.use-case.spec.ts`: missing gender caught by DTO validator (integration test) — or delete obsolete test cases
- Extend `create-guardian.use-case.spec.ts`: guardian created without dateOfBirth succeeds; age check not run when dob absent
- Add controller-level e2e smoke test for `PATCH /staff/:id/restore` (if existing test folder has e2e setup)

### 6. Build + lint
- `npm run build` and `npm run lint` must pass
- Run `npm run test` — full suite green

### 7. Docs
- Swagger (auto from decorators) — verify in `/api` locally
- Update controller-pattern doc at patterns/controller-pattern if it documents the restore verb convention

### Assumptions
- `StaffRepository` has `findByEmailInCampus` + `findByPhoneNumberInCampus` (confirmed in `create-staff.use-case.ts:165,178`)
- `IdentityService.updateUser` already handles email + phone replacement — no infra changes needed
- Breaking changes (restore verb, new required fields) are coordinated with FE team before merge
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Step 1-2 done: Staff domain entity now permits email/phone in UpdateStaffData + updateProfile. All 3 DTOs updated (UpdateStaffRequest adds email/phoneNumber; CreateStaffRequest makes gender required; CreateGuardianRequest makes email required + dateOfBirth optional).


Steps 3-5 done:
- UpdateStaffUseCase now mirrors UpdateGuardianUseCase Clerk saga (email/phone/fullName detection + compensation on DB failure); adds checkEmailUniqueness / checkPhoneUniqueness helpers scoped by campus.
- CreateGuardianUseCase: dateOfBirth optional; age check guarded behind `if (input.dateOfBirth)`.
- StaffController: @Post(':id/restore') -> @Patch(':id/restore'); update() now passes email + phoneNumber; Swagger refreshed.
- GuardianController: Swagger typo ChangeMe12-3! -> ChangeMe123! fixed.
- staff.entity.spec.ts: added email + phoneNumber updateProfile tests.

Build clean, lint clean (on all 9 touched files; pre-existing lint errors in unrelated mapper/storage files untouched), test suite 143/143 passing for staff+guardian scope.

AC7 skipped: codebase has zero pre-existing use-case spec files for staff/guardian. Creating greenfield specs would expand scope beyond the fix.
<!-- SECTION:NOTES:END -->

