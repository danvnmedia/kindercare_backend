---
id: '39'
title: 'Implement Cloudflare R2 Storage and CMS Frontend Alignment'
status: done
priority: high
labels:
  - storage
  - r2
  - cloudflare
  - cms
  - frontend
  - docker
createdAt: '2026-01-12T00:00:00.000Z'
updatedAt: '2026-01-12T00:00:00.000Z'
timeSpent: 0
---
# Implement Cloudflare R2 Storage and CMS Frontend Alignment

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
This task covers multiple improvements made in a single session:

1. **CMS Frontend-Backend Type Alignment** - Audited and fixed frontend types to match backend API
2. **Cloudflare R2 Storage Integration** - Implemented S3-compatible presigned URL support
3. **Docker Configuration Fixes** - Fixed Windows line endings and database initialization
4. **Database Seed Script** - Created comprehensive seed data for all tables

**Context:**
- Frontend: kindercare_frontend (cms-feature branch)
- Backend: kindercare_backend (feat/using-clean-architecture branch)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Frontend Comment types match backend (parentCommentId, depth, replyCount, CommentWithRepliesResponse)
- [x] #2 Frontend File types include campusId field
- [x] #3 Frontend GetCommentsResponse uses totalCount/activeCount (not total/hasMore)
- [x] #4 R2StorageService created with presigned URL support
- [x] #5 StorageModule auto-detects R2 vs local storage
- [x] #6 Docker entrypoint.sh line endings fixed (dos2unix)
- [x] #7 Comprehensive seed.ts created for all database tables
- [x] #8 AWS SDK packages added to package.json
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Part 1: CMS Frontend Type Alignment

1. Audit Post types - Compatible
2. Audit Comment types - Fixed mismatches
3. Audit Category types - Compatible
4. Audit File types - Fixed missing campusId
5. Audit Campus/Settings types - Compatible

### Part 2: Cloudflare R2 Storage

1. Create R2StorageService implementing StorageService interface
2. Update StorageModule to conditionally use R2 or local storage
3. Add AWS SDK packages to package.json
4. Update .env.example with R2 configuration

### Part 3: Docker Fixes

1. Add dos2unix and netcat-openbsd to Dockerfile
2. Convert entrypoint.sh line endings in Dockerfile
3. Fix healthcheck to not require specific database name

### Part 4: Database Seed

1. Create comprehensive seed.ts with all tables
2. Add sample data for campuses, users, roles, staff, students, etc.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
### 2026-01-12 Implementation Notes

## Files Changed - Backend

### New Files
- `src/infra/storage/r2-storage.service.ts` - Cloudflare R2 storage with presigned URLs
- `prisma/seed.ts` - Comprehensive database seed (replaced minimal version)

### Modified Files
- `src/infra/storage/storage.module.ts` - Auto-detect R2 vs local storage
- `package.json` - Added @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
- `.env.example` - Added R2 configuration variables
- `Dockerfile` - Added dos2unix, netcat-openbsd; convert line endings
- `docker-compose.yml` - Fixed healthcheck

## Files Changed - Frontend

### Modified Files
- `src/features/comments/types.ts` - Fixed to match backend:
  - `parentId` → `parentCommentId`
  - Added `depth`, `replyCount` fields
  - Added `CommentWithRepliesResponse` wrapper type
  - `GetCommentsResponse`: `total` → `totalCount`, added `activeCount`, removed `hasMore`

- `src/features/comments/services/comment.service.ts` - Updated return type to `GetCommentsResponse`

- `src/features/files/types.ts` - Added `campusId` field to `FileResponse`

## R2 Storage Configuration

Environment variables (already in .env):
```
CLOUDFLARE_ACCOUNT_ID=xxx
CLOUDFLARE_R2_BUCKET=kindercare-testing
CLOUDFLARE_R2_ACCESS_KEY=xxx
CLOUDFLARE_R2_SECRET_KEY=xxx
R2_PUBLIC_DOMAIN=https://kindercare-testing.myouri.website
```

## Storage Service Flow

```
StorageModule.useFactory()
  ├── If R2 env vars set → R2StorageService
  └── Otherwise → LocalStorageService
```

## R2StorageService Methods

- `getUploadSignedUrl(key, contentType, expiresIn)` - PutObjectCommand presigned URL
- `getSignedUrl(key, expiresIn)` - Public URL if R2_PUBLIC_DOMAIN set, else GetObjectCommand presigned URL
- `delete(key)` - DeleteObjectCommand

## Database Seed Tables (24 tables)

| Category | Tables |
|----------|--------|
| Core | Campus, CampusSetting, StudentCodeSequence |
| Auth/RBAC | Permission, Role, RolePermission, User, UserRole |
| Staff | StaffType, Staff |
| Students | Student, Guardian, GuardianRelationship, GuardianStudent |
| Academic | GradeLevel, Subject, SchoolYear, Class, ClassStaff, Enrollment |
| Attendance | StudentAttendance |
| CMS | PostCategory, Post, PostCategoryLink, PostAudience, PostComment, PostReaction |
| Files | File, Attachment |

## Docker Commands

```bash
# Build and run (after changes)
docker-compose down -v
docker builder prune -f
docker-compose build --no-cache
docker-compose up

# Run seed
docker-compose exec app npx prisma db seed
```

## Git Commit Messages

**Backend:**
```
feat(storage): implement Cloudflare R2 presigned URL support

- Add R2StorageService using AWS SDK v3 (S3-compatible)
- Update StorageModule to auto-detect R2 vs local storage
- Add comprehensive database seed for all tables
- Fix Docker entrypoint.sh Windows line endings
- Fix docker-compose healthcheck
```

**Frontend:**
```
feat(cms): align frontend types with backend API and add missing services

- Fix Comment types (parentCommentId, depth, CommentWithRepliesResponse)
- Fix GetCommentsResponse structure (totalCount, activeCount)
- Fix FileResponse to include campusId field
- Add Comment and PostCategory feature modules
```
<!-- SECTION:NOTES:END -->
