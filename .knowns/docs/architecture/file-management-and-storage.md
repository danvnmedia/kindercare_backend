---
title: File Management and Storage
description: File upload lifecycle, storage abstraction, attachments, and the signed-URL upload flow
createdAt: '2026-05-05T17:48:59.131Z'
updatedAt: '2026-05-05T17:48:59.131Z'
tags:
  - architecture
  - file
  - storage
  - upload
  - attachments
---

# File Management and Storage

> File upload, storage, and attachment handling. Source under `src/domain/file-management/`, `src/application/file-management/`, `src/infra/storage/`.

## Two Roles

The system separates **storage** (where bytes live) from **file metadata** (a database row tracking ownership, status, and references):

- `File` — Prisma row in the `file` table. Has `key`, `bucket`, `mimeType`, `size`, `status`, `uploadedBy`, `campusId`.
- `Attachment` — link between a `File` and a `Post` (with order). One file can be attached to many posts.
- `StorageService` — port for putting/getting bytes (currently `LocalStorageService`; replaceable with S3/GCS).

```
File row                          Storage backend
─────────                         ───────────────
{ id, key, status: PENDING }      (no bytes yet)
       │
       │  client uploads via signed URL
       ▼
{ status: UPLOADED }              key = "files/{campusId}/{id}-{filename}"

Attachment row references File.id
```

## Schema

```prisma
model File {
  id              String  @id @default(uuid()) @db.Uuid
  key             String  @unique           // path/identifier in the storage backend
  bucket          String?
  storageProvider String  @default("LOCAL") // LOCAL | S3 | …
  filename        String
  mimeType        String
  size            BigInt
  extension       String?
  status          String  @default("PENDING")    // PENDING | UPLOADED | PROCESSED | ERROR
  uploadedBy      String  @db.Uuid
  isDeleted       Boolean @default(false)
  campusId        String  @db.Uuid
  uploader        User    @relation(fields: [uploadedBy], references: [id], onDelete: Restrict)
  campus          Campus  @relation(fields: [campusId], references: [id], onDelete: Restrict)
  attachments     Attachment[]
  attendanceLogImages StudentAttendanceLog[] @relation("AttendanceLogImage")
}

model Attachment {
  id      String @id @default(uuid()) @db.Uuid
  postId  String @db.Uuid
  fileId  String @db.Uuid
  comment String?
  order   Int    @default(0)
  post    Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  file    File @relation(fields: [fileId], references: [id], onDelete: Restrict)
  @@unique([postId, order])
}
```

Notes:

- `File.size` is `BigInt` to handle large media without overflow.
- `Attachment.fileId` uses `onDelete: Restrict` — you can't hard-delete a file that's still attached anywhere. Soft-delete via `File.isDeleted` instead.
- `Attachment` cascades from `Post`. If a post is hard-deleted, its attachments go too (the underlying file rows survive — they may be attached elsewhere or used in attendance logs).

## Upload Lifecycle

The flow is **two-phase**: backend issues a signed URL → client PUTs the bytes → backend marks the file `UPLOADED`.

```
┌──────────┐  POST /files/upload  ┌─────────┐  signed URL  ┌─────────┐
│ Client   │ ────────────────────▶│ Backend │ ────────────▶│ Client  │
└──────────┘                      └─────────┘              └─────────┘
                                                                │
                                                                │ PUT bytes
                                                                ▼
                                                          ┌────────────┐
                                                          │  Storage   │
                                                          └────────────┘
                                                                │
                                          POST /files/:id/complete │
                                                                ▼
                                                          ┌─────────┐
                                                          │ Backend │ status = UPLOADED
                                                          └─────────┘
```

### `UploadFileUseCase`

```typescript
const fileId = new UniqueEntityID().toString();
const key = `files/${campusId}/${fileId}-${filename}`;

const file = File.create({
  key, filename, mimeType, size: BigInt(size),
  uploadedBy, campusId,
  bucket: bucket ?? process.env.STORAGE_BUCKET ?? null,
  storageProvider: storageProvider ?? "LOCAL",
}, fileId);

const uploadUrl = await this.storageService.getUploadSignedUrl(key, mimeType);
await this.fileRepository.create(file);   // status = PENDING

return right({ file, uploadUrl });
```

The use case returns an `Either<Error, { file, uploadUrl }>`. The controller maps `Right` to a 200 with the URL the client should `PUT` to.

### `CompleteUploadUseCase`

After the client PUTs successfully, it calls back to flip the `File.status` from `PENDING` → `UPLOADED`. Until that happens, attachments to this file are rejected (the `AddAttachmentUseCase` calls `file.isAvailable()`).

`File.isAvailable()` returns `status === UPLOADED && !isDeleted`. A file can also be `PROCESSED` (post-thumbnailing, etc.) — same effect.

### Status enum

`FileStatus` (`src/domain/file-management/enums/file-status.enum.ts`):

| Status | Meaning |
|--------|---------|
| `PENDING` | Row exists, bytes not yet stored |
| `UPLOADED` | Bytes stored; available for attachment |
| `PROCESSED` | Backend post-processing complete (e.g. thumbnail generated) |
| `ERROR` | Upload or processing failed; client should retry |

## Storage Port

`src/application/file-management/ports/storage.service.ts`:

```typescript
export abstract class StorageService {
  abstract getUploadSignedUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;
  abstract delete(key: string): Promise<void>;
  abstract getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}
```

The port is intentionally minimal. Three operations: get a write URL, get a read URL, delete. No streaming, no metadata.

## Local Storage Adapter

`src/infra/storage/local-storage.service.ts` is the current implementation. It writes to `./uploads/` (or `UPLOAD_DIR`) and serves via `BASE_URL + key`. It's not a true signed URL — anyone with the URL can read or write. Acceptable for development, **not for production**.

To swap to S3 or GCS:

1. Implement `StorageService` with the cloud SDK.
2. Bind in `StorageModule.providers` (`{ provide: StorageService, useClass: S3StorageService }`).
3. Set `STORAGE_BUCKET` env var; the `UploadFileUseCase` already reads it.

No use case or domain code changes — that's the point of the port.

## Campus Scoping

Every `File` belongs to a campus. The `key` includes the campus ID for organisational clarity:

```
files/{campusId}/{fileId}-{filename}
```

`AddAttachmentUseCase` rejects attaching a file to a post in a **different** campus, even if the calling user has access to both. This prevents accidental cross-campus content sharing through file references.

## Image Files in Attendance

`StudentAttendanceLog.imageFileId` references a `File` for drop-off photos. The repository uses `onDelete: SetNull` so deleting the file doesn't break the log; the log just shows "image unavailable".

## Soft Delete

`File.isDeleted` flags the row as removed. The bytes can still be in storage — separate cleanup is required (see [@doc/architecture/queue-and-cronjob](architecture/queue-and-cronjob) for the cron-based approach).

The repository excludes `isDeleted: true` rows from `findById` by default, so soft-deleted files immediately stop being attachable.

## File Management Use Cases

| Use case | Endpoint | Purpose |
|----------|----------|---------|
| `UploadFileUseCase` | `POST /files/upload` | Issue signed URL + create PENDING row |
| `CompleteUploadUseCase` | `POST /files/:id/complete` | Mark UPLOADED |
| `GetFileUseCase` | `GET /files/:id` | Read URL + metadata |
| `DeleteFileUseCase` | `DELETE /files/:id` | Soft-delete the row |

Hard delete (admin) calls `StorageService.delete(key)` then drops the row — but only when no `Attachment` row references it (Prisma `Restrict` enforces that).

## Module Wiring

`FileManagementModule` (`src/infra/http/modules/file-management/file-management.module.ts`) imports `PrismaModule`, `StorageModule`, `RequestContextModule`, `CampusModule`. Exports `FILE_REPOSITORY` so `ContentManagementModule` and `AttendanceModule` can read files.

## Pitfalls

| Mistake | Symptom |
|---------|---------|
| Hardcoding the storage provider in a use case | Locks us out of switching backends; depend on the port |
| Issuing a signed URL without creating the DB row | Orphan bytes in storage; always create row first |
| Letting the client choose the `key` | Filename collisions, path traversal — always derive `key` server-side |
| Marking `UPLOADED` before the client has actually PUT the bytes | Attachments to non-existent bytes |
| Hard-deleting a file with active attachments | Prisma's `Restrict` will throw — soft-delete instead |
| Sharing files across campuses | Don't — enforce campus match at the use case |

## Reference

| File | Notes |
|------|-------|
| `src/domain/file-management/entities/file.entity.ts` | Status helpers, `isAvailable()` |
| `src/application/file-management/use-cases/upload-file.use-case.ts` | Two-phase upload start |
| `src/application/file-management/ports/storage.service.ts` | The port |
| `src/infra/storage/local-storage.service.ts` | Dev implementation |
| `src/application/content-management/use-cases/add-attachment.use-case.ts` | Attachment validation rules |
