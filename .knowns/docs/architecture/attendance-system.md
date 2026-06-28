---
title: Attendance System
description: 'Master-detail model for student attendance: one summary per student-day plus an append-only log of check-in/out events'
createdAt: '2026-05-05T17:48:08.388Z'
updatedAt: '2026-05-05T17:48:08.388Z'
tags:
  - architecture
  - attendance
  - master-detail
  - audit
---

# Attendance System

> Tracks daily student attendance using a **master-detail** schema. One summary row per student per day; many log events feed it. Source under `src/domain/attendance/`, `src/application/attendance/`.

## Why Master-Detail?

A student can be checked in/out multiple times per day (e.g. morning drop-off, lunch pickup, afternoon return). Storing every event lets us compute presence accurately, while a denormalised summary makes daily reports and listings cheap.

```
StudentAttendanceSummary  (1 row per student per day)
  ├─ status: PRESENT | ABSENT | LATE | EXCUSED | LEFT_EARLY
  ├─ firstCheckinAt    ─┐ cached from logs
  ├─ lastCheckoutAt    ─┤
  └─ totalMinutesPresent┘
       │
       └─ StudentAttendanceLog[]  (one row per check-in or check-out event)
            ├─ type: CHECK_IN | CHECK_OUT
            ├─ timestamp
            ├─ method: TEACHER_APP | MANUAL_ENTRY
            └─ optional: deviceId, createdById, note, imageFileId
```

## Schema

```prisma
model StudentAttendanceSummary {
  id                  String   @id @default(uuid()) @db.Uuid
  studentId           String   @db.Uuid
  classId             String   @db.Uuid
  campusId            String   @db.Uuid
  date                DateTime @db.Date
  status              String   @default("PRESENT")
  firstCheckinAt      DateTime?
  lastCheckoutAt      DateTime?
  totalMinutesPresent Int      @default(0)
  updatedById         String?  @db.Uuid
  note                String?
  logs                StudentAttendanceLog[]
  @@unique([studentId, date])              // one row per student per day
  @@index([campusId, date, status])         // for daily reports
}

model StudentAttendanceLog {
  id                  String   @id @default(uuid()) @db.Uuid
  attendanceSummaryId String   @db.Uuid
  type                String                                    // CHECK_IN | CHECK_OUT
  timestamp           DateTime @db.Timestamptz(6)
  method              String                                    // TEACHER_APP | MANUAL_ENTRY
  deviceId            String?
  createdById         String?  @db.Uuid
  note                String?
  imageFileId         String?  @db.Uuid                         // photo of the child being checked in
  attendanceSummary   StudentAttendanceSummary @relation(fields: [attendanceSummaryId], references: [id], onDelete: Cascade)
  imageFile           File?    @relation("AttendanceLogImage", fields: [imageFileId], references: [id], onDelete: SetNull)
}
```

The `@@unique([studentId, date])` constraint is the safety net — even with concurrent writers, a student can only have one summary per calendar day.

## Domain Methods

`StudentAttendanceSummary` (`src/domain/attendance/entities/student-attendance-summary.entity.ts`):

| Method | Purpose |
|--------|---------|
| `updateStatus(status, updatedById?)` | Overwrite the day's status |
| `setFirstCheckinAt(time)` | Cache from logs |
| `setLastCheckoutAt(time)` | Cache from logs |
| `setTotalMinutesPresent(minutes)` | Cache from logs |
| `recalculateCachedTimes(logs)` | Re-derive `firstCheckin`, `lastCheckout`, `totalMinutes` from a fresh log list |
| `update(data)` | Bulk update of summary fields |
| `getCompositeKey()` | `${studentId}-${YYYY-MM-DD}` — useful for de-duplicating in batch jobs |

`recalculateCachedTimes(logs)` walks pairs of `CHECK_IN` / `CHECK_OUT` to compute `totalMinutesPresent`. If the day ends with an unmatched `CHECK_IN`, that span is **not** counted (the student forgot to check out — operator follow-up).

## Use Cases

| Use case | Endpoint | Notes |
|----------|----------|-------|
| `RecordAttendanceUseCase` | `POST /attendance` | Single check-in or check-out for a student |
| `BulkRecordAttendanceUseCase` | `POST /attendance/bulk` | Record an entire class at once (saving teacher taps) |
| `UpdateAttendanceUseCase` | `PATCH /attendance/:id` | Modify status / note / cached times |
| `GetAttendanceByIdUseCase` | `GET /attendance/:id` | Single lookup with logs |
| `GetClassAttendanceUseCase` | `GET /classes/:id/attendance?date=...` | Daily roster |
| `GetStudentAttendanceUseCase` | `GET /students/:id/attendance` | Time series for a student |

`BulkRecordAttendanceUseCase` is the most interesting:

1. Validate the class exists and belongs to the campus.
2. For each record:
   - Validate student exists in the same campus.
   - Skip if attendance already exists for the date (`@@unique` would also block).
   - Build a `StudentAttendanceSummary` and an initial `CHECK_IN` `StudentAttendanceLog`.
3. Persist via `attendanceRepository.saveManySummariesWithLogs(toCreate)` — atomic.
4. Return `{ created, skipped }` with reasons for each skipped record.

This pattern (validate, batch, partial-success report) is reusable for any "import this list" workflow.

## Audit Fields

Every attendance row tracks **who** wrote it:

- `StudentAttendanceSummary.updatedById` — last user to mutate the summary
- `StudentAttendanceLog.createdById` — the teacher/staff who recorded the event

Use cases take `currentUser: User` (or `createdById` from the request body for offline scenarios) and write it explicitly. See [@doc/architecture/audit-trail-soft-delete-patterns](architecture/audit-trail-soft-delete-patterns).

## Image Capture

Logs may include a photo (`imageFileId` → `File`). The flow:

1. Frontend uploads the photo via the file management API (see [@doc/architecture/file-management-and-storage](architecture/file-management-and-storage)).
2. The teacher app submits the attendance with the resulting `imageFileId`.
3. Repository links the log to the file (`File.attendanceLogImages` relation).

`onDelete: SetNull` on the file relation ensures the log survives even if the image is purged.

## Method Field

`method: TEACHER_APP | MANUAL_ENTRY` distinguishes how the record came in. UI shows a different icon, and reports can split "manual corrections" from automatic taps. There is no enforcement at the DB; the enum is captured as a string for forward-compatibility (e.g. future RFID readers).

## Module Wiring

`AttendanceModule` (`src/infra/http/modules/attendance.module.ts`) imports `PrismaModule`, `RequestContextModule`, `CampusModule`, and depends on `STUDENT_REPOSITORY` and `CLASS_REPOSITORY` for cross-entity validation.

The attendance summary and log share a single repository (`STUDENT_ATTENDANCE_REPOSITORY` → `PrismaStudentAttendanceRepository`) because they're always read together.

## Performance Notes

- `[campusId, date, status]` composite index supports the most common report query: "all PRESENT students at campus X on date Y".
- `recalculateCachedTimes` is O(n log n) per summary — fine for a school day's worth of events.
- `BulkRecordAttendanceUseCase` is N+1 on validation but keeps the persist step batched. For class sizes >100, consider precomputing the student lookup.

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Treating logs as the source of truth and re-deriving every read | Slow daily reports — use the cached summary fields |
| Updating `firstCheckinAt` without re-running `recalculateCachedTimes` | Cache drifts out of sync with logs |
| Allowing two summaries for the same student-day | Schema's `@@unique` blocks this; if Prisma errors, your code is racing |
| Soft-deleting attendance | We don't — there's no `isDeleted` here. To "delete" an event, add a corrective log or update the summary status to `EXCUSED` |
| Mixing UTC and local-day boundaries | The `date` column is `Date` (UTC midnight). Always convert in the controller, not in SQL |

## Reference

| File | Notes |
|------|-------|
| `src/domain/attendance/entities/student-attendance-summary.entity.ts` | Master entity + cache recalculation |
| `src/domain/attendance/entities/student-attendance-log.entity.ts` | Detail entity |
| `src/domain/attendance/enums/attendance-status.enum.ts` | PRESENT / ABSENT / LATE / EXCUSED / LEFT_EARLY |
| `src/application/attendance/use-cases/bulk-record-attendance.use-case.ts` | Batch import with partial-success |
| `src/infra/persistence/prisma/repositories/prisma-student-attendance.repository.ts` | Combined summary + log persistence |
