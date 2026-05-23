---
title: Audit Event Context Shapes
description: 'Per-action JSONB context shape for `audit_event.context`. Source of truth for what each use case writes and what the FE display-template registry consumes.'
createdAt: '2026-05-19T20:14:31.630Z'
updatedAt: '2026-05-23T15:27:58.710Z'
tags:
  - audit
  - reference
  - contracts
---

# Audit Event Context Shapes

> Source-of-truth for the `audit_event.context` JSONB column per action type. Use-cases write to this shape inside their `recorder.record(input, tx)` call; FE display templates ([@doc/specs/admin-audit-log](specs/admin-audit-log) FR-7) consume these fields by name.

## Conventions

- All shapes are **flat JSON objects**. No nested objects unless explicitly stated.
- `actorName` is the acting admin's display name at write-time. Caller-supplied from `currentUser.profile?.fullName`; may be `null` when the actor has no profile (e.g. service accounts).
- `targetName` is the audited entity's name at write-time. **Recorder-supplied** via snapshot lookup against the same tx — callers do NOT include it in `context`. The recorder merges it into `context` automatically (see [@task-9cpd5c](task) — snapshot resolution). When the caller pre-populates `targetName` (e.g. for hard-delete scenarios where the row is gone by the time `record()` runs), the caller's value wins per Scenario 4.
- All `Date` fields are serialized as ISO-8601 strings (`new Date(...).toISOString()`) so the JSONB column stores stable, sortable values readable by both backend and frontend.
- Structural FK fields (`fromClassId`, `schoolYearId`, etc.) hold raw UUIDs; their `*Name` siblings carry the value as displayed at write-time and survive renames / hard deletes (immutable history).
- A `null` `*Name` field means the source entity was not eager-loaded by the use case at the time of the write. UI must handle null gracefully ("(unknown class)" fallback).

## Shapes

### Enrollment lifecycle (5 actions — @task-nrm0az)

#### `ENROLL_STUDENT_TO_CLASS`

```json
{
  "actorName": "Alice Nguyen",
  "targetName": "Bob Tran",
  "classId": "8a7b6c5d-...",
  "className": "Sunflowers",
  "enrollmentDate": "2026-05-18T00:00:00.000Z"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | `currentUser.profile?.fullName ?? null` |
| `targetName` | recorder | snapshot of `student.fullName` at write time |
| `classId` | caller | `input.classId` |
| `className` | caller | `classEntity.name` from `ClassRepository.findById` (eager-loaded) |
| `enrollmentDate` | caller | `input.enrollmentDate.toISOString()` |

Display template: `"Staff {{actorName}} enrolled Student {{targetName}} into Class {{className}}"`.

#### `TRANSFER_STUDENT` *(Spec Scenario 1)*

```json
{
  "actorName": "Alice Nguyen",
  "targetName": "Bob Tran",
  "fromClassId": "c-source-uuid",
  "fromClassName": "Sunflowers",
  "toClassId": "c-target-uuid",
  "toClassName": "Roses",
  "transferDate": "2026-05-18T00:00:00.000Z"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | as above |
| `targetName` | recorder | as above |
| `fromClassId` | caller | `active.classId` from `findActiveByStudentId` |
| `fromClassName` | caller | `active.class?.name` — may be `null` if not eager-loaded |
| `toClassId` | caller | `input.toClassId` |
| `toClassName` | caller | `targetClass.name` |
| `transferDate` | caller | `(input.transferDate ?? new Date()).toISOString()` |

Display template: `"Staff {{actorName}} transferred Student {{targetName}} from {{fromClassName}} to {{toClassName}}"`.

#### `WITHDRAW_FROM_CLASS`

```json
{
  "actorName": "Alice Nguyen",
  "targetName": "Bob Tran",
  "classId": "8a7b6c5d-...",
  "className": "Sunflowers",
  "exitDate": "2026-05-18T00:00:00.000Z",
  "exitReason": "WITHDRAWN",
  "note": "Family relocated overseas"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | as above |
| `targetName` | recorder | snapshot of `student.fullName` |
| `classId` | caller | from the resolved `enrollment.classId` |
| `className` | caller | `enrollment.class?.name` — eager-loaded by `findById` |
| `exitDate` | caller | `(input.endDate ?? closed.endDate).toISOString()` |
| `exitReason` | caller | `ExitReason` literal: `WITHDRAWN | TRANSFERRED | GRADUATED | COMPLETED` |
| `note` | caller | `input.note ?? null` — free-form withdraw reason note |

Display template: `"Staff {{actorName}} withdrew Student {{targetName}} from Class {{className}} ({{exitReason}})"`.

#### `REGISTER_FOR_SCHOOL_YEAR`

```json
{
  "actorName": "Alice Nguyen",
  "targetName": "Bob Tran",
  "schoolYearId": "sy-uuid",
  "schoolYearName": "SY 2025-2026",
  "gradeLevelId": "gl-uuid",
  "gradeLevelName": "Lớp Mầm",
  "enrollmentDate": "2025-09-01T00:00:00.000Z"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | as above |
| `targetName` | recorder | as above |
| `schoolYearId` | caller | `input.schoolYearId` |
| `schoolYearName` | caller | `schoolYear.name` from `SchoolYearRepository.findById` |
| `gradeLevelId` | caller | `input.gradeLevelId` |
| `gradeLevelName` | caller | `gradeLevel.name` from `GradeLevelRepository.findById` |
| `enrollmentDate` | caller | `input.enrollmentDate.toISOString()` |

Display template: `"Staff {{actorName}} registered Student {{targetName}} for School Year {{schoolYearName}} ({{gradeLevelName}})"`.

#### `WITHDRAW_FROM_SCHOOL_YEAR`

```json
{
  "actorName": "Alice Nguyen",
  "targetName": "Bob Tran",
  "schoolYearId": "sy-uuid",
  "schoolYearName": "SY 2025-2026",
  "exitDate": "2026-03-15T00:00:00.000Z",
  "exitReason": "GRADUATED",
  "alsoClosedChildClassEnrollmentId": "enr-uuid"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | as above |
| `targetName` | recorder | as above |
| `schoolYearId` | caller | `parent.schoolYearId` |
| `schoolYearName` | caller | `parent.schoolYear?.name` — may be `null` if SY not eager-loaded |
| `exitDate` | caller | `(input.exitDate ?? new Date()).toISOString()` |
| `exitReason` | caller | `ExitReason` literal |
| `alsoClosedChildClassEnrollmentId` | caller | id of the child class-enrollment that was atomically closed in the cascade, or `null` if none was open |

Display template: `"Staff {{actorName}} withdrew Student {{targetName}} from School Year {{schoolYearName}} ({{exitReason}})"`.

### Profile edits (3 actions — @task-e5v0wm)

For these actions the diff lives in `before_value` / `after_value` — only the keys that actually changed appear, per Scenario 3 of [@doc/specs/admin-audit-log](specs/admin-audit-log). `context` carries the actor/target snapshots only. When the computed diff is empty (no-op PATCH) the use case skips the recorder call so audit history is not polluted.

Wiring lives in the `update-*.use-case.ts` files; the `computeDiff` helper at `src/application/audit/utils/compute-diff.ts` is the single source of truth for the comparison rules (Object.is for primitives, `getTime()` for Dates, JSON fallback for nested values).

#### `EDIT_STUDENT_PROFILE`

```json
// context
{
  "actorName": "Alice Nguyen",
  "targetName": "Bob Tran"
}
```

Scenario 3 — PATCH `{ phoneNumber: "555-2222" }` against `phoneNumber="555-1111"`, `fullName="Bob Tran"`:

```json
// before_value
{ "phoneNumber": "555-1111" }
// after_value
{ "phoneNumber": "555-2222" }
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | `currentUser.profile?.fullName ?? null` |
| `targetName` | recorder | snapshot of `student.fullName` |
| `before_value` | caller | `computeDiff(before, after).before` — restricted to changed fields among `fullName, email, phoneNumber, address, dateOfBirth, nickname, gender` |
| `after_value` | caller | `computeDiff(before, after).after` — same field set |

Display template: `"Staff {{actorName}} updated profile of Student {{targetName}}"`.

#### `EDIT_GUARDIAN_PROFILE`

```json
// context
{
  "actorName": "Alice Nguyen",
  "targetName": "Carol Pham"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | as above |
| `targetName` | recorder | snapshot of `guardian.fullName` |
| `before_value` | caller | `computeDiff` over `fullName, email, phoneNumber, address, dateOfBirth, gender, occupation, workAddress` |
| `after_value` | caller | same field set |

Display template: `"Staff {{actorName}} updated profile of Guardian {{targetName}}"`.

When the guardian has a linked `User` and the patch touches `email` / `phoneNumber` / `fullName`, the Clerk-saga path runs Clerk first, then the UoW callback persists the row AND emits the audit row. A recorder failure rolls back the Prisma transaction AND triggers the existing Clerk-revert compensation in `update-guardian.use-case.ts`.

#### `EDIT_STAFF_PROFILE`

```json
// context
{
  "actorName": "Alice Nguyen",
  "targetName": "Dan Le"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | as above |
| `targetName` | recorder | snapshot of `staff.fullName` |
| `before_value` | caller | `computeDiff` over `fullName, email, phoneNumber, staffTypeId, address, dateOfBirth, gender, startDate` |
| `after_value` | caller | same field set |

Display template: `"Staff {{actorName}} updated profile of Staff {{targetName}}"`.

`staffTypeId` changes appear in the diff as `before_value.staffTypeId` / `after_value.staffTypeId`. The default-role re-assignment that accompanies a staff-type change runs as a sibling `tx.assignRoles` call inside the same UoW — it does NOT emit a separate audit row. Clerk-saga semantics mirror Guardian.

### Archive / restore (6 actions — @task-2c5xq3)

Soft-delete lifecycle. Six actions emitted by `archive-*.use-case.ts` and `restore-*.use-case.ts`. All six share the same context + diff shape; only the action code and direction of the `isArchived` flip differ.

`context` carries the actor snapshot only — `targetName` is resolved by the recorder from the entity row. `before_value` / `after_value` capture the `isArchived` flip and nothing else: the action code itself names the operation, and the related `user.isActive` flip + Clerk lock/unlock are saga side effects, not part of the entity diff.

#### Shared shape

```json
// context
{
  "actorName": "Alice Nguyen"
}
```

```json
// Archive direction
"before_value": { "isArchived": false }
"after_value":  { "isArchived": true }

// Restore direction
"before_value": { "isArchived": true }
"after_value":  { "isArchived": false }
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | `currentUser.profile?.fullName ?? null` |
| `targetName` | recorder | snapshot of `{student|guardian|staff}.fullName` |
| `before_value` | caller | hard-coded `{ isArchived }` flip — opposite of the new value |
| `after_value` | caller | hard-coded `{ isArchived }` flip — the new value |

#### Per-action codes and display templates

| Action | targetType | Display template |
|---|---|---|
| `ARCHIVE_STUDENT` | `student` | `"Staff {{actorName}} archived Student {{targetName}}"` |
| `RESTORE_STUDENT` | `student` | `"Staff {{actorName}} restored Student {{targetName}}"` |
| `ARCHIVE_GUARDIAN` | `guardian` | `"Staff {{actorName}} archived Guardian {{targetName}}"` |
| `RESTORE_GUARDIAN` | `guardian` | `"Staff {{actorName}} restored Guardian {{targetName}}"` |
| `ARCHIVE_STAFF` | `staff` | `"Staff {{actorName}} archived Staff {{targetName}}"` |
| `RESTORE_STAFF` | `staff` | `"Staff {{actorName}} restored Staff {{targetName}}"` |

#### Clerk side effect (Guardian + Staff)

For guardian/staff archive/restore the Clerk identity is locked/unlocked **before** the UoW callback. The Clerk call is best-effort: `lockIdentity` / `unlockIdentity` failures are caught and logged but do NOT block the DB transaction.

If `tx.recordAudit` throws inside the UoW callback → the Prisma transaction rolls back (`isArchived` and `user.isActive` flips revert) BUT the Clerk lock/unlock is **not** reverted. This desync is accepted at v1 per the task description for [@task-2c5xq3](task) — the archive/restore use cases do not implement the saga reverse direction. Operators reconcile via the next archive/restore call or manually in the Clerk dashboard. Profile edits use the full saga (see Guardian section above).

The `user.isActive` flip rides on the same UoW as `isArchived` and the audit row, so those three are atomic — only the Clerk call is outside.

### Creation (3 actions — @task-7ah3pb)

Three actions emitted by `create-{student,guardian,staff}.use-case.ts`. All three share the same `{ actorName, name, ... }` context shape — the action code identifies which entity was created, and the recorder resolves `targetName` from the freshly-inserted row inside the same transaction.

Creation has no "before" state. `before_value` / `after_value` are both `null` (defaults). The full snapshot of "what was created" lives in `context` so the audit row is self-sufficient even if the underlying entity is later hard-deleted (Scenario 4 of the spec).

#### Shared shape

```json
// context — common keys
{
  "actorName": "Alice Nguyen",
  "name": "Eli Pham"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | `currentUser.profile?.fullName ?? null` |
| `name` | caller | `{student|guardian|staff}.fullName` at write-time |
| `code` | caller | `studentCode` / `staffCode`; **omitted for Guardian** (no code) |
| `email` | caller (Guardian only) | snapshot of contact email |
| `phoneNumber` | caller (Guardian only) | snapshot of contact phone |

#### Per-action codes and display templates

| Action | targetType | `context` keys | Display template |
|---|---|---|---|
| `CREATE_STUDENT` | `student` | `actorName`, `name`, `code` | `"Staff {{actorName}} created Student {{name}} ({{code}})"` |
| `CREATE_GUARDIAN` | `guardian` | `actorName`, `name`, `email`, `phoneNumber` | `"Staff {{actorName}} created Guardian {{name}}"` |
| `CREATE_STAFF` | `staff` | `actorName`, `name`, `code` | `"Staff {{actorName}} created Staff {{name}} ({{code}})"` |

#### Atomicity + Clerk compensation (Student + Guardian + Staff)

All three creation use cases run the entity insert + (optional) `User` row + (Student only) `assignGuardians` + the audit row inside a single `unitOfWork.run`. Clerk provisioning runs **outside** the UoW, before it (mirrors the Guardian/Staff create-Clerk-then-UoW pattern). If `tx.recordAudit` throws → the Prisma transaction rolls back the entity, the User row, and the relationship inserts; the outer `catch` then calls `identityPort.deleteIdentity` to compensate the Clerk user. The DB is the unit of atomicity; the Clerk row is reconciled by the saga's reverse direction.

Student-specific: `createUserAccount=true` is the only path that provisions Clerk; without it, no Clerk call happens and no compensation is needed on UoW failure.

### Guardian ↔ Student (2 actions — @task-7ah3pb)

Two actions emitted by `{link,unlink}-*.use-case.ts` for the guardian–student relationship. Two endpoint pairs map onto these two action codes — `student/link-student-with-guardian.use-case.ts` + `guardian/link-student-to-guardian.use-case.ts` both emit `LINK_GUARDIAN_TO_STUDENT`; the unlink mirrors emit `UNLINK_GUARDIAN_FROM_STUDENT`. The action name is direction-agnostic; routing is irrelevant to the audit row.

`targetType = "student"` for both actions — entity-history reads on the student surface both sides of the relationship lifecycle. The `context` carries both names + the relationship type so the FE can render the link without follow-up reads.

#### Shared shape

```json
// context
{
  "actorName": "Alice Nguyen",
  "studentId": "uuid-of-student",
  "studentName": "Eli Pham",
  "guardianId": "uuid-of-guardian",
  "guardianName": "Carol Pham",
  "relationshipId": "rel-mother",
  "relationshipType": "Mother"
}
```

| Field | Source | Notes |
|---|---|---|
| `actorName` | caller | `currentUser.profile?.fullName ?? null` |
| `studentId` / `studentName` | caller | resolved before UoW from `studentRepository.findById` |
| `guardianId` / `guardianName` | caller | resolved before UoW from `guardianRepository.findById` |
| `relationshipId` | caller | the GuardianRelationshipType id |
| `relationshipType` | caller | the GuardianRelationshipType `name` at write-time |
| `before_value` / `after_value` | — | both `null`; the action code carries the operation semantic |

#### Per-action codes and display templates

| Action | targetType | Display template |
|---|---|---|
| `LINK_GUARDIAN_TO_STUDENT` | `student` | `"Staff {{actorName}} linked {{guardianName}} ({{relationshipType}}) to Student {{studentName}}"` |
| `UNLINK_GUARDIAN_FROM_STUDENT` | `student` | `"Staff {{actorName}} unlinked {{guardianName}} ({{relationshipType}}) from Student {{studentName}}"` |

#### Relationship snapshot pre-resolution (Unlink only)

The link row carries the FK to `GuardianRelationshipType`; once `tx.removeGuardians` runs, that FK is gone and the row is unreachable for snapshot lookup. The unlink use case therefore resolves `relationshipId` + `relationshipType` from `studentRepository.getStudentGuardians` **before** entering the UoW callback, then writes those snapshots into `context` inside the callback. This keeps the audit row self-sufficient post-hard-delete (Scenario 4 of the spec) without requiring the recorder to do its own snapshot lookup against the just-deleted row.
## Open shapes (added by future tasks)

All 19 v1 action shapes from [@doc/specs/admin-audit-log](specs/admin-audit-log) FR-1 are documented above. New actions added in v2 land below as their wiring tasks ship.

### Staff ↔ Class (3 actions — @doc/specs/subject-removal-classstaff-role-refactor)

Three actions emitted by the staff-assignment use cases under `src/application/class-management/use-cases/class-staff/` — `assign-staff-to-class.use-case.ts`, `remove-staff-from-class.use-case.ts`, and `change-class-staff-role.use-case.ts`. All three target the staff member at the audit-row level (`targetType = "staff"`, `targetId = staffId`); `context` carries the class context (`classId`) plus the role(s) involved. The staff member's identity is therefore reachable from the row's `targetId` — it is intentionally not duplicated into `context`, consistent with the profile-edit convention.

These actions cannot piggy-back on a single shared shape because role-change carries `previousRole + newRole` while assign/remove carry a single `role`. Per-action shapes below.

`role`, `previousRole`, and `newRole` are stored as the `ClassStaffRole` enum string (`HOMEROOM`, `ASSISTANT`, `BOARDING`) — see [@doc/decisions/subject-removal](decisions/subject-removal) for the Vietnamese↔English label mapping and the deferred-enum reservation list.

#### `ASSIGN_STAFF_TO_CLASS`

```json
// context
{
  "actorName": "Alice Nguyen",
  "classId": "uuid-of-class",
  "role": "HOMEROOM"
}
```

| Field | Source | Notes |
|---|---|---|
| `targetId` | caller (row-level, not context) | `staffId` |
| `targetType` | caller (row-level) | `"staff"` |
| `actorName` | caller | `currentUser.profile?.fullName ?? null` |
| `classId` | caller | the class the staff is being assigned to |
| `role` | caller | `ClassStaffRole` enum value at write-time |
| `before_value` / `after_value` | — | both `null`; assignment has no field-diff semantic |

Display template: `"Staff {{actorName}} assigned Staff to a class as {{role}}"`. Class + staff names render from sibling resolver lookups since the row carries only IDs.

Domain invariant: HOMEROOM is exactly one per class. Reject duplicate at the use case (typed `409 HOMEROOM_ALREADY_ASSIGNED`) and at the DB (partial unique index `class_staff_homeroom_unique WHERE role = 'HOMEROOM'`). The DB index is the structural backstop for race conditions.

#### `REMOVE_STAFF_FROM_CLASS`

```json
// context
{
  "actorName": "Alice Nguyen",
  "classId": "uuid-of-class",
  "role": "ASSISTANT"
}
```

| Field | Source | Notes |
|---|---|---|
| `targetId` | caller (row-level) | `staffId` |
| `targetType` | caller (row-level) | `"staff"` |
| `actorName` | caller | as above |
| `classId` | caller | the class the staff is being removed from |
| `role` | caller (pre-delete snapshot) | the role the staff held at removal time — resolved BEFORE `tx.deleteClassStaff` so the value survives the row deletion |
| `before_value` / `after_value` | — | both `null` |

Display template: `"Staff {{actorName}} removed Staff (was {{role}}) from a class"`.

Pre-resolution rule: the assignment row is deleted inside the UoW callback, so `role` must be captured from `classStaffRepository.findByPair` *before* the callback enters (see `remove-staff-from-class.use-case.ts`). The audit row therefore stays self-sufficient post-hard-delete (Scenario 4 of [@doc/specs/admin-audit-log](specs/admin-audit-log)).

#### `CHANGE_STAFF_ROLE`

```json
// context
{
  "actorName": "Alice Nguyen",
  "classId": "uuid-of-class",
  "previousRole": "ASSISTANT",
  "newRole": "HOMEROOM"
}
```

| Field | Source | Notes |
|---|---|---|
| `targetId` | caller (row-level) | `staffId` |
| `targetType` | caller (row-level) | `"staff"` |
| `actorName` | caller | as above |
| `classId` | caller | the class context |
| `previousRole` | caller (pre-update snapshot) | the role before the change; captured before `tx.updateClassStaff` so it survives the in-place update |
| `newRole` | caller | the role after the change |
| `before_value` / `after_value` | — | both `null`; the role-pair in context carries the change semantic |

Display template: `"Staff {{actorName}} changed Staff role from {{previousRole}} to {{newRole}}"`.

No-op rule: when `newRole === existing.role`, the use case short-circuits (Scenario 6 of [@doc/specs/subject-removal-classstaff-role-refactor](specs/subject-removal-classstaff-role-refactor)) — no DB write and no audit emission. The FE still gets a stable 200 response shape carrying the existing row.

HOMEROOM uniqueness applies on promotions to HOMEROOM identically to `ASSIGN_STAFF_TO_CLASS` — same domain check + same partial unique index backstop.

#### Per-action codes and display templates

| Action | targetType | `context` keys | Display template |
|---|---|---|---|
| `ASSIGN_STAFF_TO_CLASS` | `staff` | `actorName`, `classId`, `role` | `"Staff {{actorName}} assigned Staff to a class as {{role}}"` |
| `REMOVE_STAFF_FROM_CLASS` | `staff` | `actorName`, `classId`, `role` | `"Staff {{actorName}} removed Staff (was {{role}}) from a class"` |
| `CHANGE_STAFF_ROLE` | `staff` | `actorName`, `classId`, `previousRole`, `newRole` | `"Staff {{actorName}} changed Staff role from {{previousRole}} to {{newRole}}"` |

## Failure modes

If a use case writes a context field that no display template references, the FE renders the template literally with the missing variable. To prevent silent template drift:

- Add a new field → update this doc and the FE i18n registry in the same PR.
- Remove a field → write a migration of historical rows (or accept the FE fallback).
- Rename a field → never; treat field names as wire-compatible after first deploy.
