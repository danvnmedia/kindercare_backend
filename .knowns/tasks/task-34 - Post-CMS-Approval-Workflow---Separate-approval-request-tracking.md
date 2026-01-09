---
id: '34'
title: 'Post & CMS: Approval Workflow - Separate approval request tracking'
status: todo
priority: medium
labels:
  - post
  - approval
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:12:26.615Z'
updatedAt: '2026-01-09T03:12:55.042Z'
timeSpent: 0
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
- [ ] #1 SubmitPostForApprovalUseCase creates request with title/content snapshot
- [ ] #2 SubmitPostForApprovalUseCase transitions post to PENDING_APPROVAL status
- [ ] #3 ApprovePostUseCase validates admin permission
- [ ] #4 ApprovePostUseCase updates request status and transitions post to APPROVED
- [ ] #5 RejectPostUseCase requires reviewNote
- [ ] #6 RejectPostUseCase transitions post back to DRAFT for editing
- [ ] #7 GetPendingApprovalsUseCase returns paginated list scoped to campus
- [ ] #8 Multiple approval rounds supported (full history preserved)
- [ ] #9 Campus setting checked for requireTeacherApproval
- [ ] #10 Request/Response DTOs created
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create use cases in src/application/content-management/use-cases/approval/:
   a. SubmitPostForApprovalUseCase:
      - Inject PostRepository, PostApprovalRequestRepository, CampusSettingRepository
      - Validate post is in DRAFT status
      - Check campus setting requireTeacherApproval
      - If approval not required, skip to APPROVED status
      - Create PostApprovalRequest with:
        - titleSnapshot: post.title
        - contentSnapshot: post.content (JSON)
        - status: PENDING
        - submittedById, submittedAt
      - Transition post to PENDING_APPROVAL
      - Save both and return
   b. ApprovePostUseCase:
      - Validate caller is admin
      - Find latest pending approval request
      - Update request: status=APPROVED, reviewedById, reviewedAt
      - Transition post to APPROVED status
      - Save both and return
   c. RejectPostUseCase:
      - Validate caller is admin
      - Validate reviewNote is provided
      - Find latest pending approval request
      - Update request: status=REJECTED, reviewedById, reviewedAt, reviewNote
      - Transition post back to DRAFT
      - Save both and return
   d. GetPendingApprovalsUseCase:
      - Validate caller is admin
      - Query pending requests with post details
      - Filter by campusId
      - Return paginated list
   e. GetPostApprovalHistoryUseCase:
      - Find all requests for post
      - Return chronological list
2. Create DTOs:
   - SubmitForApprovalResponse: postId, requestId, status
   - ApprovePostRequest: note? (optional)
   - RejectPostRequest: note (required)
   - ApprovalRequestResponse: id, postId, status, submittedBy, reviewedBy, reviewNote, titleSnapshot, createdAt
   - PendingApprovalResponse: request info + post summary
3. Add endpoints to PostController:
   - POST /posts/:id/submit
   - POST /posts/:id/approve
   - POST /posts/:id/reject
   - GET /posts/pending-approval
   - GET /posts/:id/approval-history
4. Add permission checks (admin guard for approve/reject)
5. Add repository bindings
<!-- SECTION:PLAN:END -->

