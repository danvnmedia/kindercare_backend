---
title: Post and Content Management
createdAt: '2026-01-08T04:53:28.269Z'
updatedAt: '2026-01-09T02:10:48.066Z'
description: >-
  PRD for the post/content management feature - Facebook-like posts with
  approval workflow, reactions, and nested comments
tags:
  - prd
  - content-management
  - post
  - phase-4
---
# PRD: Post and Content Management

> Facebook-like post system for school-to-parent communication with approval workflows, reactions, and nested comments.

## Problem
Schools lack a centralized, controlled way to communicate with parents. Current solutions don't provide proper approval workflows for teacher posts, flexible audience targeting (class, grade, individual), or rich interactions like reactions and comments.

## Goals
- [ ] Streamlined communication: Single platform for all school-to-parent communication
- [ ] Controlled publishing: Configurable approval workflow for teacher posts
- [ ] Rich interactions: Facebook-like experience with reactions (>30% rate) and comments (>10% rate)
- [ ] Audit trail: Complete history of all post changes and approvals

## Non-Goals
- Push notifications (separate feature)
- Direct messaging between parents and teachers
- Video conferencing integration
- Multi-language translation
- Post templates
- Read receipts / view tracking

## Requirements

### Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Create posts with title (200 chars), rich text content (JSON/Tiptap format), attachments (max 50 images) | Must |
| F2 | Save drafts with auto-save every 30 seconds | Must |
| F3 | Schedule posts for future publish date | Must |
| F4 | Target audience: campus-wide, grade-level, class, or individual students | Must |
| F5 | Approval workflow: teachers submit for admin approval (toggle per campus) | Must |
| F6 | Reactions: HEART only (one per user, toggleable) | Should |
| F7 | Nested comments: max 1000 chars, up to 3 levels deep, edit/delete own, author/admin can delete any | Should |
| F8 | Campus-defined categories with name, color, icon, sort order | Should |
| F9 | Pin posts to top of feed (max 3 per campus, optional expiration) | Could |
| F10 | Post history: track all content edits with diffs | Should |
| F11 | Status history: track all status changes with timestamps and actors | Must |

### Non-Functional
- **Performance**: Feed queries optimized with indexes on (campusId, status, publishAt) and (campusId, isPinned)
- **Security**: Teachers can only target their own classes/students; admins can target any scope
- **Audit**: Soft delete for posts and comments to preserve audit trail

## Technical Approach

### Architecture

```
+-----------+     +-----------+     +-----------+
|  Parent   |     |  Teacher  |     |   Admin   |
|   App     |     |   App     |     |   App     |
+-----+-----+     +-----+-----+     +-----+-----+
      |                 |                 |
      +-----------------+-----------------+
                        v
               +----------------+
               |  Post Module   |
               |   (NestJS)     |
               +-------+--------+
                       |
      +----------------+----------------+
      v                v                v
+-----------+   +-----------+   +-----------+
|   Post    |   | Approval  |   |Engagement |
|  Service  |   |  Service  |   |  Service  |
+-----------+   +-----------+   +-----------+
```

**State Machine:**
```
DRAFT -> PENDING_APPROVAL -> APPROVED -> PUBLISHED -> ARCHIVED
                |                ^
            REJECTED ------------+ (resubmit after edit)
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Content format | JSON (Tiptap/ProseMirror) | Cross-platform rendering; structured data; native editor format |
| Content storage | JSONB + extracted plain text | JSON for rendering, plain text for full-text search |
| Comment structure | Nested (adjacency list) | Allows threaded discussions; simple pattern with parent_comment_id |
| Comment nesting | parent_comment_id + depth | PostgreSQL WITH RECURSIVE handles tree queries; depth limited to 3 levels |
| Reaction model | HEART only, toggleable | Simple like/unlike; no reaction type complexity |
| Approval tracking | Separate ApprovalRequest records | Preserves full history of all submissions |
| Content history | Snapshot on each edit | Enables diff view and audit compliance |
| Audience targeting | PostAudience join table | Flexible multi-target without duplication |

### Dependencies
- Campus module (for campus settings and scoping)
- User module (for author, reviewer relationships)
- File upload service (for attachments) - external dependency

## Data Models

### New Models

| Model | Purpose |
|-------|---------|
| Post | Core post entity with content, status, pinning |
| PostCategory | Campus-scoped categories (name, color, icon) |
| PostCategoryLink | Many-to-many post-category relationship |
| PostAudience | Audience targeting (campus/grade/class/student scope) |
| PostReaction | User heart reactions (unique per user per post) |
| PostComment | Nested comments with parent_comment_id, depth (max 3), soft delete |
| PostApprovalRequest | Approval submissions with snapshots and decisions |
| PostHistory | Content edit history |
| PostHistoryStatus | Status change audit log |
| CampusSetting | Campus-level settings (requireTeacherApproval, maxPinnedPosts, etc.) |

## API Endpoints

### Posts
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /posts | Create post |
| GET | /posts | List posts (filtered by audience) |
| GET | /posts/:id | Get post detail |
| PATCH | /posts/:id | Update post |
| DELETE | /posts/:id | Soft delete post |
| POST | /posts/:id/submit | Submit for approval |
| POST | /posts/:id/publish | Publish (admin or approved) |

### Approval
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /posts/pending-approval | List pending posts (admin) |
| POST | /posts/:id/approve | Approve post |
| POST | /posts/:id/reject | Reject with reason |

### Engagement
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /posts/:id/heart | Toggle heart reaction |
| GET | /posts/:id/comments | List comments (returns nested tree) |
| POST | /posts/:id/comments | Add root comment (depth=0) |
| POST | /comments/:id/replies | Add reply to comment (depth check enforced) |
| PATCH | /comments/:id | Edit comment |
| DELETE | /comments/:id | Delete comment (soft delete) |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /post-categories | List categories |
| POST | /post-categories | Create category (admin) |
| PATCH | /post-categories/:id | Update category |
| DELETE | /post-categories/:id | Deactivate category |

## Edge Cases & Error Handling

| Scenario | Expected Behavior |
|----------|-------------------|
| Teacher targets class they don't teach | 403 Forbidden |
| Edit post after approval | Reverts to DRAFT, requires re-approval |
| React to archived post | 400 Bad Request |
| Comment on post with comments disabled | 403 Forbidden |
| Reply exceeds max depth (3) | 400 Bad Request "Max nesting depth reached" |
| Reply to deleted comment | 400 Bad Request |
| Pin when max pinned reached | 400 with message to unpin another first |
| Delete post with comments | Soft delete post; comments remain for audit |
| Delete comment with replies | Soft delete; replies visible with "deleted" placeholder |
| Scheduled publish in past | Publish immediately |
| Upload more than 50 images | 400 Bad Request |

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| High volume of posts slowing feed | Med | Pagination, caching, proper indexes |
| Approval bottleneck delays communication | High | Dashboard for pending posts; notification to admins |
| Parents missing urgent posts | High | Future: push notifications (out of scope) |
| Large attachments impacting performance | Med | File size limits; lazy loading |
| Deep comment threads affecting UX | Low | Limit depth to 3 levels; collapse deep threads in UI |

## Success Metrics
- Average reaction rate: >30% of readers
- Comment engagement: >10% of readers
- Teacher post approval time: <4 hours

## Open Questions
- [ ] Should comments support @mentions?
- [ ] Should parents be able to share posts externally?
- [ ] Maximum attachment file size per post?
- [ ] Should urgent posts trigger push notifications? (ties to notifications feature)
