---
id: q17s4p
title: Implement file table schema changes in codebase
status: done
priority: high
labels: []
createdAt: '2026-01-11T22:39:56.485Z'
updatedAt: '2026-01-12T00:44:09.209Z'
timeSpent: 0
---
# Implement file table schema changes in codebase

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement code changes required for the updated file table schema (ref: @task-l8i1lt).

## New Fields to Add
- `bucket` (S3 Bucket Name)
- `storage_provider` (default: S3, options: S3, GCS, LOCAL)
- `extension` (file extension: jpg, pdf, docx)
- `is_deleted` (boolean, default: false - for soft delete)
- `key` becomes unique

## Status Enum Change
OLD: PENDING, ACTIVE, DELETED
NEW: PENDING, UPLOADED, PROCESSED, ERROR

Note: DELETED status removed - soft delete now uses `is_deleted` boolean field instead.

---

## Files to Update by Layer

### 1. DATABASE LAYER
| File | Changes |
|------|------|
| `prisma/schema.prisma` | Add bucket, storage_provider, extension, is_deleted fields; make key unique; update status comment |
| `prisma/migrations/[new]` | Create migration for ALTER TABLE with new columns and constraints |

### 2. DOMAIN LAYER
| File | Changes |
|------|------|
| `src/domain/file-management/entities/file.entity.ts` | Add bucket, storage_provider, extension, isDeleted to FileProps; update status methods; add soft delete methods |
| `src/domain/file-management/enums/file-status.enum.ts` | Change enum: PENDING, UPLOADED, PROCESSED, ERROR (remove DELETED) |

### 3. APPLICATION LAYER (Use Cases)
| File | Changes |
|------|------|
| `src/application/file-management/use-cases/upload-file.use-case.ts` | Add bucket, storage_provider, extension to request interface and File.create() |
| `src/application/file-management/use-cases/complete-upload.use-case.ts` | Change markAsActive() to markAsUploaded() |
| `src/application/file-management/use-cases/delete-file.use-case.ts` | Change to soft delete (set is_deleted=true) instead of hard delete |
| `src/application/file-management/use-cases/get-file.use-case.ts` | Pass bucket/storage_provider for signed URL; filter out deleted files |

### 4. APPLICATION LAYER (Ports)
| File | Changes |
|------|------|
| `src/application/file-management/ports/file.repository.ts` | Add filter fields: bucket, storage_provider, extension, is_deleted; add softDelete method |
| `src/application/file-management/ports/storage.service.ts` | Add bucket, storageProvider params to all methods |

### 5. INFRASTRUCTURE - PERSISTENCE
| File | Changes |
|------|------|
| `src/infra/persistence/prisma/mapper/prisma-file.mapper.ts` | Map new fields in toDomain(), toDomainSimple(), toPrisma() including isDeleted |
| `src/infra/persistence/prisma/repositories/prisma-file.repository.ts` | Add new fields to allowedFilterFields; implement softDelete; filter deleted by default |

### 6. INFRASTRUCTURE - STORAGE
| File | Changes |
|------|------|
| `src/infra/storage/local-storage.service.ts` | Update method signatures to accept bucket/storageProvider |

### 7. INFRASTRUCTURE - HTTP (Controller & DTOs)
| File | Changes |
|------|------|
| `src/infra/http/controllers/file.controller.ts` | Handle new fields in initiateUpload(); update delete to soft delete |
| `src/infra/http/dtos/file/initiate-upload.request.ts` | Add bucket, storage_provider, extension with validators |
| `src/infra/http/dtos/file/file.response.ts` | Add bucket, storage_provider, extension, isDeleted with @Expose() |

### 8. CONTENT MANAGEMENT INTEGRATION
| File | Changes |
|------|------|
| `src/application/content-management/use-cases/add-attachment.use-case.ts` | Add file status validation (must be UPLOADED/PROCESSED); check is_deleted |

---

## Implementation Order
1. Domain layer (entity, enum)
2. Application layer (ports, use cases)
3. Infrastructure persistence (mapper, repository)
4. Infrastructure storage service
5. Infrastructure HTTP (DTOs, controller)
6. Database migration
7. Content management integration
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 FileStatus enum updated: PENDING, UPLOADED, PROCESSED, ERROR
- [x] #2 FileProps interface has bucket, storage_provider, extension
- [x] #3 File entity has updated status methods (markAsUploaded, isProcessed, isError)
- [x] #4 Prisma schema updated with new fields and unique key constraint
- [x] #5 Migration created and tested
- [x] #6 PrismaFileMapper maps all new fields bidirectionally
- [x] #7 PrismaFileRepository includes new filter fields
- [x] #8 StorageService port accepts bucket/storageProvider params
- [x] #9 LocalStorageService implements updated interface
- [x] #10 InitiateUploadRequest DTO has new fields with validators
- [x] #11 FileResponse DTO exposes new fields
- [x] #12 FileController passes new fields through upload flow
- [x] #13 AddAttachment use case validates file status
- [x] #14 All existing tests pass
- [x] #15 FileProps interface has is_deleted boolean field
- [x] #16 File entity has soft delete methods (markAsDeleted, isDeleted)
- [x] #17 Delete use case performs soft delete (is_deleted=true) not hard delete
- [x] #18 Repository filters out deleted files by default
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Phase 1: Domain Layer (Core Changes)

**Step 1.1: Update FileStatus enum**
- Location: `src/domain/file-management/enums/file-status.enum.ts`
- Change: PENDING, ACTIVE, DELETED → PENDING, UPLOADED, PROCESSED, ERROR
- Note: DELETED status removed - soft delete now uses isDeleted boolean

**Step 1.2: Update File entity**
- Location: `src/domain/file-management/entities/file.entity.ts`
- Add to FileProps interface:
  - bucket: string | null
  - storageProvider: string (default: 'LOCAL')
  - extension: string | null
  - isDeleted: boolean (default: false)
- Update status type: "PENDING" | "UPLOADED" | "PROCESSED" | "ERROR"
- Add/Update methods:
  - markAsUploaded() - replaces markAsActive()
  - markAsProcessed() - new
  - markAsError() - new
  - markAsDeleted() - sets isDeleted=true (NOT status)
  - isUploaded() - replaces isActive()
  - isProcessed() - new
  - isError() - new
  - isDeleted() - checks isDeleted field (NOT status)
- Update File.create() with new defaults

### Phase 2: Application Layer

**Step 2.1: Update FileRepository port**
- Location: `src/application/file-management/ports/file.repository.ts`
- Add method: softDelete(id: string): Promise<void>
- All find methods should filter out isDeleted=true by default

**Step 2.2: Update UploadFileUseCase**
- Location: `src/application/file-management/use-cases/upload-file.use-case.ts`
- Add to request interface: storageProvider (optional, default 'LOCAL')
- Extract extension from filename server-side
- Pass bucket (from env), storageProvider, extension to File.create()

**Step 2.3: Update CompleteUploadUseCase**
- Location: `src/application/file-management/use-cases/complete-upload.use-case.ts`
- Change: file.markAsActive() → file.markAsUploaded()

**Step 2.4: Update DeleteFileUseCase**
- Location: `src/application/file-management/use-cases/delete-file.use-case.ts`
- Change from hard delete to soft delete:
  - Remove storageService.delete() call (keep file in storage)
  - Call file.markAsDeleted() (sets isDeleted=true)
  - Use repository.update() (not delete())

**Step 2.5: Update GetFileUseCase**
- Location: `src/application/file-management/use-cases/get-file.use-case.ts`
- Add check: if file.isDeleted() return "File not found"

### Phase 3: Infrastructure - Persistence

**Step 3.1: Update PrismaFileMapper**
- Location: `src/infra/persistence/prisma/mapper/prisma-file.mapper.ts`
- Map new fields: bucket, storageProvider, extension, isDeleted
- Update status type casting
- Update toPrisma() and toPrismaUpdate() methods

**Step 3.2: Update PrismaFileRepository**
- Location: `src/infra/persistence/prisma/repositories/prisma-file.repository.ts`
- Add isDeleted filter to all find methods (isDeleted: false)
- Add new fields to allowedFilterFields
- Implement softDelete method if needed
- Update toPrismaUpdate to include isDeleted

### Phase 4: Infrastructure - HTTP

**Step 4.1: Update InitiateUploadRequest DTO**
- Location: `src/infra/http/dtos/file/initiate-upload.request.ts`
- Add optional: storageProvider (validated enum: S3, GCS, LOCAL)
- Note: extension derived server-side from filename

**Step 4.2: Update FileResponse DTO**
- Location: `src/infra/http/dtos/file/file.response.ts`
- Add: bucket, storageProvider, extension, isDeleted
- Update status enum values in documentation

**Step 4.3: Update FileController**
- Location: `src/infra/http/controllers/file.controller.ts`
- initiateUpload: pass storageProvider if provided
- delete endpoint now does soft delete (handled by use case)

### Phase 5: Database

**Step 5.1: Update Prisma schema**
- Location: `prisma/schema.prisma`
- Add fields to File model:
  - bucket String? @map("bucket")
  - storageProvider String @default("LOCAL") @map("storage_provider")
  - extension String? @map("extension")
  - isDeleted Boolean @default(false) @map("is_deleted")
- Make key unique: @unique
- Add index: @@index([key])
- Add index: @@index([isDeleted])

**Step 5.2: Generate migration**
- Run: npx prisma migrate dev --name add_file_storage_fields

### Phase 6: Integration Updates

**Step 6.1: Update AddAttachment use case**
- Location: `src/application/content-management/use-cases/add-attachment.use-case.ts`
- Add validation: file must be UPLOADED or PROCESSED status
- Add check: file.isDeleted() should be false

## Key Design Decisions

1. **Extension extraction**: Derived server-side from filename for consistency
2. **Default storageProvider**: 'LOCAL' (matches current LocalStorageService)
3. **Soft delete behavior**: Sets isDeleted=true but keeps file in storage (allows recovery)
4. **StorageService interface**: No changes needed - bucket/storageProvider are metadata only
5. **Repository filtering**: All find methods exclude deleted files by default
<!-- SECTION:PLAN:END -->

