---
id: '34'
title: 'Post & CMS: Approval Workflow - Separate approval request tracking'
status: done
priority: medium
labels:
  - post
  - approval
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:12:26.615Z'
updatedAt: '2026-01-10T03:00:48.622Z'
timeSpent: 710
---
# Post & CMS: Approval Workflow - Separate approval request tracking

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement enhanced approval workflow with separate request tracking.

**Context:**
- Teachers submit posts for admin approval
- Each submission creates PostApprovalRequest with content snapshot
- Supports multiple rounds (reject -> edit -> resubmit)
- Campus setting controls if approval is required
- Reference: @doc/prds/post-and-content-management

**Use Cases:**
1. SubmitPostForApprovalUseCase - create approval request with snapshot
2. ApprovePostUseCase - approve and transition post status
3. RejectPostUseCase - reject with required reason
4. GetPendingApprovalsUseCase - list pending for admin
5. GetPostApprovalHistoryUseCase - get all approval requests for a post

**API Endpoints:**
- POST /posts/:id/submit - submit for approval
- POST /posts/:id/approve - approve (admin)
- POST /posts/:id/reject - reject with reason (admin)
- GET /posts/pending-approval - list pending (admin)
- GET /posts/:id/approval-history - get approval history
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 SubmitPostForApprovalUseCase creates request with title/content snapshot
- [x] #2 SubmitPostForApprovalUseCase transitions post to PENDING_APPROVAL status
- [x] #3 ApprovePostUseCase validates admin permission
- [x] #4 ApprovePostUseCase updates request status and transitions post to APPROVED
- [x] #5 RejectPostUseCase requires reviewNote
- [x] #6 RejectPostUseCase transitions post back to DRAFT for editing
- [x] #7 GetPendingApprovalsUseCase returns paginated list scoped to campus
- [x] #8 Multiple approval rounds supported (full history preserved)
- [x] #9 Campus setting checked for requireTeacherApproval
- [x] #10 Request/Response DTOs created
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## VERIFIED Implementation Plan (Post-Analysis)

### Analysis Summary
After thorough codebase analysis, I found:
1. **Existing use cases** (ApprovePostUseCase, RejectPostUseCase, SubmitForReviewUseCase) exist but do NOT create PostApprovalRequest records
2. **PostApprovalRequest entity and repository** already exist but repository is NOT registered in module
3. **PostStatus uses PENDING_REVIEW** (not PENDING_APPROVAL as originally stated)
4. **Campus setting check** for requireTeacherApproval is NOT implemented in existing flow

### Approach: Enhance Existing + Add New Queries
Instead of creating duplicate use cases, enhance existing ones and add query use cases.

---

### Phase 1: Module Registration (Required First)
1. Register PrismaPostApprovalRequestRepository in content-management.module.ts
2. Export POST_APPROVAL_REQUEST_REPOSITORY for cross-module access

### Phase 2: Enhance Existing Use Cases

#### 2a. Enhance SubmitForReviewUseCase
- Add CampusSettingRepository and PostApprovalRequestRepository injection
- Check requireTeacherApproval setting from campus
- If approval required: Create PostApprovalRequest with titleSnapshot, contentSnapshot, status: PENDING; Transition post to PENDING_REVIEW
- If approval NOT required: Auto-publish post (skip to PUBLISHED status); Do NOT create approval request

#### 2b. Enhance ApprovePostUseCase
- Add PostApprovalRequestRepository injection
- Find latest PENDING approval request for the post
- Update request: status: APPROVED, reviewedById, reviewedAt
- Keep existing post status transition logic

#### 2c. Enhance RejectPostUseCase
- Add PostApprovalRequestRepository injection
- Find latest PENDING approval request for the post
- Update request: status: REJECTED, reviewedById, reviewedAt, reviewNote
- Keep existing post status transition logic (transitions to DRAFT)

### Phase 3: Create New Query Use Cases

#### 3a. GetPendingApprovalsUseCase
Location: src/application/content-management/use-cases/approval/get-pending-approvals.use-case.ts
- Inject PostApprovalRequestRepository
- Validate caller is admin
- Call findPendingByCampus(campusId, paginationParams)
- Return paginated list of pending requests with post details

#### 3b. GetPostApprovalHistoryUseCase
Location: src/application/content-management/use-cases/approval/get-post-approval-history.use-case.ts
- Inject PostApprovalRequestRepository
- Call findByPostId(postId)
- Return chronological list of all approval requests

### Phase 4: Create DTOs
Location: src/infra/http/dtos/post/approval/
- ApprovalRequestResponse: id, postId, status, titleSnapshot, submittedBy, submittedAt, reviewedBy, reviewedAt, reviewNote, createdAt
- PendingApprovalListItemResponse: extends with post summary

### Phase 5: Add Controller Endpoints
Add to PostController:
- GET /posts/pending-approval - admin only, paginated
- GET /posts/:id/approval-history - auth required

### Phase 6: Register New Components
1. Add new use cases to module providers
2. Update index.ts exports
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Complete (2026-01-09)

### Files Modified:
1. **content-management.module.ts** - Added PrismaPostApprovalRequestRepository provider and export
2. **submit-for-review.use-case.ts** - Enhanced to:
   - Check CampusSetting.requireTeacherApproval
   - Auto-publish if approval not required
   - Create PostApprovalRequest with titleSnapshot/contentSnapshot
3. **approve-post.use-case.ts** - Enhanced to update PostApprovalRequest status to APPROVED
4. **reject-post.use-case.ts** - Enhanced to update PostApprovalRequest status to REJECTED with reviewNote

### Files Created:
1. **src/application/content-management/use-cases/approval/get-pending-approvals.use-case.ts** - Admin-only paginated list of pending approvals
2. **src/application/content-management/use-cases/approval/get-post-approval-history.use-case.ts** - Get approval history for a post
3. **src/application/content-management/use-cases/approval/index.ts** - Exports
4. **src/infra/http/dtos/post/approval/approval-request.response.ts** - ApprovalRequestResponse DTO
5. **src/infra/http/dtos/post/approval/index.ts** - Exports

### Controller Endpoints Added:
- GET /posts/pending-approval - Admin-only, paginated pending approvals by campus
- GET /posts/:id/approval-history - Get all approval requests for a post

### Key Design Decisions:
- Enhanced existing use cases rather than creating duplicate ones in approval/ folder
- PostStatus uses PENDING_REVIEW (not PENDING_APPROVAL as originally in task)
- Auto-publish flow when campus doesn't require approval
- Content snapshots captured at submission time for audit trail
<!-- SECTION:NOTES:END -->

