---
id: l8i1lt
title: Update file table schema for enhanced storage support
status: done
priority: medium
labels: []
createdAt: '2026-01-11T21:21:02.361Z'
updatedAt: '2026-01-12T00:44:16.925Z'
timeSpent: 0
---
# Update file table schema for enhanced storage support

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the file table in dbdiagram.dbml to support enhanced storage configuration.

## Current Schema
- Basic file storage with key, filename, mime_type, size, status

## New Schema Changes
1. Make `key` field unique with note "S3 Path"
2. Add `bucket` field (S3 Bucket Name)
3. Add `storage_provider` field with default "S3" and options: S3, GCS, LOCAL
4. Add note to `filename` field: "Original filename: trip.jpg"
5. Add `extension` field for file type (jpg, pdf, docx)
6. Add note to `status` field: "PENDING, UPLOADED, PROCESSED, ERROR"
7. Add `is_deleted` boolean field with default false (for soft delete)
8. Add `key` to indexes

## Files to Update
- diagram/dbdiagram.dbml

## Acceptance Criteria
- [ ] key field is unique with S3 Path note
- [ ] bucket field added for S3 bucket name
- [ ] storage_provider field with default S3 and note
- [ ] filename field has descriptive note
- [ ] extension field added
- [ ] status field has note listing valid values
- [ ] is_deleted boolean field added with default false
- [ ] key added to indexes
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 key field is unique with S3 Path note
- [x] #2 bucket field added for S3 bucket name
- [x] #3 storage_provider field with default S3 and note
- [x] #4 filename field has descriptive note
- [x] #5 extension field added
- [x] #6 status field has note listing valid values
- [x] #7 key added to indexes
- [x] #8 Add is_deleted boolean
- [ ] #9 is_deleted boolean field added with default false
<!-- AC:END -->

