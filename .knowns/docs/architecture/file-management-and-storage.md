---
title: File Management and Storage
description: File upload lifecycle, storage abstraction, CMS attachments, and the presigned R2 upload flow
createdAt: '2026-05-05T17:48:59.131Z'
updatedAt: '2026-07-01T00:00:00.000Z'
tags:
  - architecture
  - file
  - storage
  - upload
  - attachments
---

# File Management and Storage

> File upload, storage, and attachment handling. Source under `src/domain/file-management/`, `src/application/file-management/`, `src/infra/storage/`.

## Current Contract

The current production flow is server-owned and two-phase:

1. Client validates/transforms the final file bytes.
2. Client calls `POST /files/initiate-upload` with metadata and business context.
3. Backend validates filename/MIME/size, derives the object key, creates a `PENDING` `File` row, then requests a presigned upload URL.
4. If signing fails, backend marks the row `ERROR`.
5. Client uploads bytes directly to storage via `PUT`.
6. Client calls `POST /files/:id/complete`.
7. Backend checks campus, uploader, pending status, storage object existence, size, and content type before marking `UPLOADED`.
8. CMS links uploaded files to posts via `Attachment` rows.

Clients must not send `uploadPath`, bucket, or object key. New folder/layout needs must be implemented as server-side mapping in `UploadFileUseCase`.

## Two Roles

The system separates storage bytes from DB metadata:

- `File` — campus-scoped DB row tracking key, metadata, owner, purpose, audience, status, soft-delete state.
- `Attachment` — CMS link between `Post` and `File`, with display order/comment.
- `StorageService` — port for upload URL, read URL, delete, and object metadata checks.

```text
Client → POST /files/initiate-upload → File(PENDING) + presigned PUT URL
Client → PUT bytes to storage
Client → POST /files/:id/complete → metadata verified → File(UPLOADED)
CMS    → add attachment by fileId → rejects unavailable/cross-campus files
```

## Schema

Current `File` model includes storage, ownership, purpose/audience routing, soft-delete, timestamps, and indexes. Keep this doc aligned with `prisma/schema.prisma` when fields change.

```prisma
model File {
  id              String   @id @default(uuid()) @db.Uuid
  key             String   @unique
  bucket          String?
  storageProvider String   @default("LOCAL") @map("storage_provider")
  filename        String
  mimeType        String   @map("mime_type")
  size            BigInt
  extension       String?
  status          String   @default("PENDING")
  purpose         String   @default("GENERAL")
  audienceType    String?  @map("audience_type")
  audienceId      String?  @map("audience_id") @db.Uuid
  classId         String?  @map("class_id") @db.Uuid
  gradeLevelId    String?  @map("grade_level_id") @db.Uuid
  status          String   @default("PENDING")
  uploadedBy      String   @map("uploaded_by") @db.Uuid
  isDeleted       Boolean  @default(false) @map("is_deleted")
  campusId        String   @map("campus_id") @db.Uuid
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  attachments     Attachment[]

  @@index([campusId])
  @@index([uploadedBy])
  @@index([status])
  @@index([purpose])
  @@index([audienceType, audienceId])
}

model Attachment {
  id      String @id @default(uuid()) @db.Uuid
  postId  String @map("post_id") @db.Uuid
  fileId  String @map("file_id") @db.Uuid
  comment String?
  order   Int    @default(0)

  post    Post @relation(fields: [postId], references: [id], onDelete: Cascade)
  file    File @relation(fields: [fileId], references: [id], onDelete: Restrict)

  @@unique([postId, order])
  @@unique([postId, fileId])
}
```

Notes:

- `File.size` is `BigInt`.
- `Attachment.fileId` uses `onDelete: Restrict`; soft-delete files instead of hard-deleting attached rows.
- `Attachment` cascades from `Post`; underlying `File` rows survive.

## Upload Lifecycle

### `UploadFileUseCase`

Current behavior:

- Accepts `filename`, `mimeType`, `size`, `uploadedBy`, required `campusId`, optional `purpose`, `audienceType`, `audienceId`. Audience context is optional; upload is a universal campus-scoped primitive for class images/banners, student images/banners, attendance/bulk images, medical/meal images, school images/banners, avatars, and CMS attachments.
- Validates upload security rules via `validateFileUpload()`.
- Derives key as `files/{campusId}/{derivedPath}/{fileId}-{sanitizedFilename}`.
- Records `storageProvider` as `R2` only when full R2 env is configured; otherwise `LOCAL`.
- Creates the `PENDING` row before requesting a signed URL.
- Marks the row `ERROR` if URL signing fails.

Derived path mapping:

| Input | Path |
|---|---|
| `POST_ATTACHMENT` | `attachment` |
| `PROFILE_PHOTO` | `profile` |
| `ATTENDANCE_IMAGE` | `attendance` |
| `GENERAL + CLASS + audienceId` | `class/{audienceId}` |
| `GENERAL + ALL` | `all` |
| fallback | `purpose.toLowerCase()` |

`campusId` is always required. File upload audience scope is intentionally narrow: omit `audienceType` or use `ALL` for campus-wide files; use `CLASS + audienceId` only when the file should be grouped under a specific class. CLASS `audienceId` is validated before `File.create()`: the target class must exist and belong to the same campus. CLASS also populates `classId` for direct filtering. The file upload API contract exposes only `ALL` and `CLASS`; any other submitted audience value is invalid.

### `CompleteUploadUseCase`

Completion order:

1. Find file by `fileId + campusId`.
2. Reject if missing.
3. Reject if `uploadedBy` differs from current user.
4. Reject unless status is `PENDING`.
5. Call `StorageService.getObjectMetadata(key)`.
6. Reject if object missing.
7. Reject if storage size differs from initiated size, when available.
8. Reject if storage content type differs from initiated MIME type, when available.
9. Mark `UPLOADED` and persist.
10. Resolve read URL via `StorageService.getSignedUrl(key)`.

Until completion, CMS attachments reject the file because `File.isAvailable()` is false.

### Status enum

| Status | Meaning |
|---|---|
| `PENDING` | Row exists; bytes not yet verified |
| `UPLOADED` | Bytes verified; file can be attached/read |
| `PROCESSED` | Post-processing complete; also available |
| `ERROR` | Initiation/cleanup/processing failed |

## Storage Port

`src/application/file-management/ports/storage.service.ts`:

```typescript
export interface StoredObjectMetadata {
  exists: boolean;
  contentLength?: number;
  contentType?: string;
  eTag?: string;
}

export abstract class StorageService {
  abstract getUploadSignedUrl(key: string, contentType: string, expiresIn?: number): Promise<string>;
  abstract delete(key: string): Promise<void>;
  abstract getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  abstract getObjectMetadata(key: string): Promise<StoredObjectMetadata>;
}
```

## Storage Implementations

`StorageModule` selects R2 when Cloudflare R2 env is fully configured. Partial R2 env fails startup. Production requires full R2 env; local storage is development-only fallback.

Required production backend env:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_ACCESS_KEY`
- `CLOUDFLARE_R2_SECRET_KEY`
- `CLOUDFLARE_R2_BUCKET`
- `R2_PUBLIC_DOMAIN` optional; if set, read URLs are public bearer-style URLs.

Operational requirements:

- Apply `config/r2-cors.example.json` to the bucket with real frontend origins.
- Browser upload CORS needs `PUT`, `OPTIONS`, and `Content-Type`.
- Frontend CSP `connect-src` must include presigned upload hosts.
- Frontend image config must allow returned read URL hosts.
- Public `R2_PUBLIC_DOMAIN` mode should be used only for public/shared media; use signed reads for private media.

`LocalStorageService` is not a realistic browser direct-upload path. It is acceptable only for dev/unit-level paths unless a local upload receiver is added.

## Campus Scoping

Every `File` belongs to a campus. Keys include `campusId` for organization, but authorization is enforced by DB lookups and use cases.

`AddAttachmentUseCase` rejects attaching a file to a post in another campus, even if the caller can access both campuses.

## CMS Attachment Rules

`AddAttachmentUseCase` currently:

1. Loads the post.
2. Verifies post campus equals request campus.
3. Requires post author or system-role admin.
4. Loads the file.
5. Requires file campus equals post campus.
6. Requires `file.isAvailable()` (`UPLOADED` or `PROCESSED`, not deleted).
7. Rejects duplicate file attachment on the same post; DB enforces `@@unique([postId, fileId])` for concurrency safety.
8. Creates `Attachment` with `order: 0`; repository `appendToPost()` owns transactional append/order behavior under a post row lock.

If `addAttachment` fails after upload completion, the file can remain uploaded but unattached. Cleanup/remediation for uploaded-orphan files is a remaining product/ops decision.

Attachment removal must remove the `Attachment` row for existing CMS attachments; it must not delete the underlying `File` row directly because the schema restricts hard file deletion while attachments exist. Frontend edit-mode bulk delete mirrors this rule: existing images call remove-attachment, while newly uploaded unattached images may call file delete.

## Soft Delete and Cleanup

`File.isDeleted` flags the DB row as removed. Repositories exclude deleted rows from normal reads.

Scheduled cleanup handles abandoned direct uploads:

- Hourly: stale `PENDING` rows older than 1 hour, batch 100.
- Daily: stale `PENDING` rows older than 24 hours, batch 500.
- Cleanup checks object metadata, deletes existing orphan objects when possible, marks rows `ERROR`, logs delete failures without blocking DB cleanup.

## File Management Use Cases

| Use case | Endpoint | Purpose |
|---|---|---|
| `UploadFileUseCase` | `POST /files/initiate-upload` | Create `PENDING` row + issue presigned upload URL |
| `CompleteUploadUseCase` | `POST /files/:id/complete` | Verify storage object + mark `UPLOADED` |
| `GetFileUseCase` | `GET /files/:id` | Return metadata + read URL for available files |
| `DeleteFileUseCase` | `DELETE /files/:id` | Soft-delete row |
| `CleanupStalePendingUploadsUseCase` | cron | Mark stale pending rows `ERROR`, delete orphan objects |

## Module Wiring

`FileManagementModule` imports Prisma, storage, request context, and campus modules. It exports `FILE_REPOSITORY` so CMS and attendance can validate/link files.

## Conventions Alignment

Current upload/CMS implementation mostly follows `@doc/conventions/implementation-checklist` and `@doc/conventions/naming-conventions`:

- Campus scoping is consistently enforced in file completion and CMS attachment linking.
- Cross-campus references are checked before attaching files to posts.
- Storage is accessed through an application port, not directly from controllers.
- Request DTOs use class-validator and controllers use campus/current-user context.

Known convention exceptions/gaps:

- CMS use cases are mixed flat/nested under `src/application/content-management/use-cases/`; avoid churn solely for folder shape unless touching those files for a broader refactor.
- `campusId` is required for all file uploads. Audience context is optional. When `audienceType` is CLASS, `audienceId` is required and campus ownership is enforced in `UploadFileUseCase`. The public file upload contract exposes only ALL and CLASS audience values.
- File delete is restricted to the uploader or a system-role admin.
- Endpoint throttling/quotas for initiate/complete remain pending.

## Pitfalls

| Mistake | Result |
|---|---|
| Letting client send `uploadPath`/key/bucket | path traversal, layout abuse, storage coupling |
| Marking `UPLOADED` before metadata verification | attachable DB row with missing/wrong bytes |
| Signing URL before creating DB row | orphan bytes if DB create fails |
| Recording `R2` while local storage is active | broken reads/debugging confusion |
| Skipping campus checks on attachments | cross-campus content leak |
| Using public read URLs for private files | auth no longer applies after URL issuance |

## Validation Snapshot 2026-07-01

Cross-agent backend review confirmed:

- Initiate → direct R2 PUT → complete flow matches code.
- Backend owns key derivation; frontend does not send `uploadPath`.
- Complete upload verifies uploader/campus/status/object metadata before `UPLOADED`.
- CMS rejects pending/deleted/cross-campus files.
- Stale pending cleanup is wired hourly/daily.

Validation previously run:

- `npm run build` passed.
- `npm test -- --runTestsByPath src/application/file-management/use-cases/upload-file.use-case.spec.ts src/application/file-management/use-cases/cleanup-stale-pending-uploads.use-case.spec.ts --runInBand` passed.
- `npm test -- --runTestsByPath src/application/file-management/use-cases/complete-upload.use-case.spec.ts --runInBand --silent` passed.

Manual deployed browser smoke is still required for real R2 bucket CORS, deployed env, CSP, upload host allowlist, and rendered public/signed read URLs.

## Reference

| File | Notes |
|---|---|
| `src/domain/file-management/entities/file.entity.ts` | status helpers, availability, soft delete |
| `src/domain/file-management/enums/file-purpose.enum.ts` | upload purpose values |
| `src/domain/file-management/enums/file-audience-type.enum.ts` | audience values |
| `src/application/file-management/use-cases/upload-file.use-case.ts` | initiate flow and key derivation |
| `src/application/file-management/use-cases/complete-upload.use-case.ts` | metadata verification and finalization |
| `src/application/file-management/use-cases/cleanup-stale-pending-uploads.use-case.ts` | stale pending cleanup |
| `src/application/file-management/ports/storage.service.ts` | storage port |
| `src/infra/storage/storage.module.ts` | R2/local selection and env gating |
| `src/infra/storage/r2-storage.service.ts` | R2 adapter |
| `src/infra/storage/local-storage.service.ts` | dev-only local adapter |
| `src/application/content-management/use-cases/add-attachment.use-case.ts` | CMS attachment validation |
| `config/r2-cors.example.json` | R2 CORS baseline |
