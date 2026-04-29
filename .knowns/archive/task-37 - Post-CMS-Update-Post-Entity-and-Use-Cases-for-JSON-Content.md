---
id: '37'
title: 'Post & CMS: Update Post Entity and Use Cases for JSON Content'
status: done
priority: high
labels:
  - post
  - content
  - json
  - tiptap
  - phase-3
createdAt: '2026-01-09T03:13:22.271Z'
updatedAt: '2026-01-09T17:17:46.012Z'
timeSpent: 467
---
# Post & CMS: Update Post Entity and Use Cases for JSON Content

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update existing Post entity and use cases to support JSON content (Tiptap format).

## Context
- Post content should be stored as JSON (Tiptap/ProseMirror format)
- Extract plain text for search functionality
- Add content version for future migrations
- Reference: @doc/prds/post-and-content-management

## Current State Analysis
The Post entity and Prisma schema ALREADY have the correct structure:
- `content: PostContent` (Record<string, unknown> | null)
- `contentText: string | null`
- `contentVersion: number`
- `campusId: string` (required)

What NEEDS UPDATE:
1. **CreatePostUseCase**: content typed as string (should be PostContent), missing campusId
2. **UpdatePostUseCase**: content typed as string (should be PostContent)
3. **PrismaPostMapper**: missing contentText, contentVersion, campusId, pinning fields, soft delete fields
4. **Request DTOs**: content typed as string (should be object)
5. **PostResponse DTO**: content typed as string, missing contentText/contentVersion
6. **Content Extraction Utility**: Does not exist yet

## Changes Required
1. Create content text extraction utility
2. Update CreatePostUseCase to accept JSON content and campusId
3. Update UpdatePostUseCase to handle JSON content
4. Update PrismaPostMapper with all missing fields
5. Update request/response DTOs for JSON content
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Post entity content property handles JSON type
- [ ] #2 Post entity has contentText for search
- [ ] #3 Post entity has contentVersion field
- [ ] #4 CreatePostUseCase accepts content as JSON object
- [ ] #5 CreatePostUseCase extracts plain text from JSON to contentText
- [ ] #6 UpdatePostUseCase handles JSON content updates
- [ ] #7 Content text extraction utility created (extracts text from Tiptap JSON)
- [ ] #8 PrismaPostMapper handles Json type correctly
- [ ] #9 Request DTOs accept content as object (not string)
- [ ] #10 Response DTOs return content as object
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create content extraction utility in src/application/content-management/utils/:
   - extractTextFromTiptap(json: object): string
   - Recursively traverse Tiptap JSON structure
   - Extract text from 'text' nodes
   - Handle paragraphs, headings, lists, etc.
   - Return concatenated plain text
2. Update Post entity:
   - Change content type from string to any/object
   - Add contentText: string | null property
   - Add contentVersion: number property (default 1)
   - Update create() to accept JSON content
   - Add updateContent(json, extractedText) method
3. Update CreatePostUseCase:
   - Accept content as JSON object in input
   - Call extractTextFromTiptap() to get plain text
   - Create entity with both content and contentText
4. Update UpdatePostUseCase:
   - Accept content as JSON object
   - Re-extract plain text on content update
   - Update both fields
5. Update PrismaPostMapper:
   - Handle Prisma.JsonValue for content field
   - Map contentText and contentVersion
6. Update DTOs:
   - CreatePostRequest: content as object (not string)
   - UpdatePostRequest: content as object
   - PostResponse: content as object
   - Add validation for content structure (optional, can be loose)
7. Add contentText to search queries (if full-text search implemented)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Completed

### Changes Made:
1. Created extractTextFromTiptap utility in src/application/content-management/utils/
2. Updated CreatePostUseCase: added campusId, JSON content type, text extraction
3. Updated UpdatePostUseCase: JSON content type, text extraction
4. Updated PrismaPostMapper: all missing fields (campusId, contentText, contentVersion, pinning, soft delete)
5. Updated Request DTOs: content as object type
6. Updated PostResponse DTO: content as object, added contentText and contentVersion
7. Updated PostAudience entity: added campusId property

All TypeScript compilation errors for changed files are resolved.
<!-- SECTION:NOTES:END -->

