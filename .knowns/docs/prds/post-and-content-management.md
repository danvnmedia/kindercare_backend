---
title: Post and Content Management
createdAt: '2026-01-08T04:53:28.269Z'
updatedAt: '2026-01-08T04:58:39.698Z'
description: >-
  PRD for the post/content management feature - Facebook-like posts with
  approval workflow, reactions, comments, and read receipts
tags:
  - prd
  - content-management
  - post
  - phase-4
---
# Post and Content Management - PRD

## Overview

A Facebook-like post system for school communication between administrators, teachers, and parents. Enables rich content sharing with flexible audience targeting, approval workflows, and engagement tracking.

## Problem Statement

Schools need a centralized, controlled way to communicate with parents. Current solutions lack:
- Proper approval workflows for teacher posts
- Flexible audience targeting (class, grade, individual)
- Engagement tracking (who read important announcements)
- Rich interactions (reactions, comments)

## Goals

1. **Streamlined Communication**: Single platform for all school-to-parent communication
2. **Controlled Publishing**: Configurable approval workflow for teacher posts
3. **Engagement Visibility**: Track parent engagement with important posts
4. **Rich Interactions**: Facebook-like experience with reactions and comments
5. **Audit Trail**: Complete history of all post changes and approvals

---

## User Roles

| Role | Capabilities |
|------|-------------|
| **School Admin** | Create posts with any scope, approve/reject teacher posts, manage categories, view analytics |
| **Teacher** | Create posts (class scope by default), submit for approval, respond to comments |
| **Parent/Guardian** | View posts for their children, react, comment, mark as read |

---

## Feature Requirements

### 1. Post Creation & Editing

#### 1.1 Post Content
- **Title**: Required, max 200 characters
- **Content**: Rich text (markdown supported), max 10,000 characters
- **Attachments**: Images and videos (max 10 per post)
- **Categories**: One or more tags from predefined list

#### 1.2 Draft & Publish Flow
- Save as draft (auto-save every 30 seconds)
- Preview before publishing
- Schedule for future publish date
- Set expiration date (optional)

#### 1.3 Audience Targeting
| Scope | Description | Who Can Use |
|-------|-------------|-------------|
| Campus-wide | All parents at the campus | Admin only |
| Grade Level | All parents of students in a grade | Admin only |
| Class | All parents of students in a class | Admin, Teacher (their classes) |
| Individual | Specific student's parents | Admin, Teacher (their students) |

### 2. Approval Workflow

#### 2.1 Campus Setting
- **Toggle**: Enable/disable teacher approval requirement per campus
- **Default**: Enabled (teachers require approval)
- Admin posts bypass approval

#### 2.2 Approval States


#### 2.3 Approval Request Model
Each submission for approval creates a record:
- Submission timestamp
- Reviewer (admin who reviews)
- Decision (APPROVED/REJECTED)
- Reason/Note (required for rejection)
- Review timestamp

#### 2.4 Multiple Rounds
- Teacher submits → Admin rejects with reason
- Teacher edits → Resubmits
- Full history preserved for audit

### 3. Reactions

#### 3.1 Reaction Types
- 👍 LIKE
- ❤️ LOVE  
- 😂 HAHA
- 😮 WOW
- 😢 SAD

#### 3.2 Behavior
- One reaction per user per post (can change)
- Reaction counts visible to all
- Author can see who reacted

### 4. Comments

#### 4.1 Structure
- Flat comments (no nested replies for simplicity)
- Max 1,000 characters per comment
- Edit/delete own comments

#### 4.2 Moderation
- Author can delete any comment on their post
- Admin can delete any comment
- Soft delete (preserve for audit)

### 5. Read Receipts

#### 5.1 Tracking
- Record when a parent views a post
- First view timestamp only (no repeat tracking)

#### 5.2 Visibility
- Author can see read count and list
- Admin can see all read receipts
- Parents cannot see others' read status

### 6. Post Categories

#### 6.1 Campus-Defined Categories
Each campus can define their own categories:
- Name, Color, Icon
- Active/Inactive toggle
- Sort order

#### 6.2 Default Categories (Seed)
- 📢 Announcement
- 📅 Event
- 📚 Homework
- 🎉 Celebration
- ⚠️ Urgent
- 📰 Newsletter

### 7. Pin/Featured Posts

#### 7.1 Pinning
- Admin can pin posts to top of feed
- Optional expiration date for pin
- Max 3 pinned posts per campus

### 8. Post History & Audit

#### 8.1 Content History
Track every edit:
- Previous title/content
- Editor (who made the change)
- Timestamp
- Diff available

#### 8.2 Status History
Track every status change:
- Previous status → New status
- Changed by (user)
- Reason/comment
- Timestamp

---

## Data Model (Conceptual)

### New Models Required

| Model | Purpose |
|-------|---------|
| PostCategory | Campus-scoped post categories |
| PostReaction | User reactions on posts |
| PostComment | User comments on posts |
| PostReadReceipt | Track who read posts |
| PostApprovalRequest | Each approval submission with decision |

### Enhanced Models

| Model | Changes |
|-------|---------|
| Post | Add: isPinned, pinnedUntil, expiresAt, requiresApproval |
| Campus | Add: settings JSON or CampusSetting relation |

---

## API Endpoints (Planned)

### Posts
- POST /posts - Create post
- GET /posts - List posts (filtered by audience)
- GET /posts/:id - Get post detail
- PATCH /posts/:id - Update post
- DELETE /posts/:id - Soft delete post
- POST /posts/:id/submit - Submit for approval
- POST /posts/:id/publish - Publish (admin or approved)

### Approval
- GET /posts/pending-approval - List pending posts (admin)
- POST /posts/:id/approve - Approve post
- POST /posts/:id/reject - Reject with reason

### Engagement
- POST /posts/:id/reactions - Add/change reaction
- DELETE /posts/:id/reactions - Remove reaction
- GET /posts/:id/comments - List comments
- POST /posts/:id/comments - Add comment
- PATCH /comments/:id - Edit comment
- DELETE /comments/:id - Delete comment
- POST /posts/:id/read - Mark as read
- GET /posts/:id/read-receipts - Get read receipts (author/admin)

### Categories
- GET /post-categories - List categories
- POST /post-categories - Create category (admin)
- PATCH /post-categories/:id - Update category
- DELETE /post-categories/:id - Deactivate category

---

## Parent App Experience

### Feed View
1. Pinned posts at top (highlighted)
2. Recent posts sorted by publishAt desc
3. Unread indicator on posts
4. Quick reaction buttons
5. Comment count badge

### Post Detail
1. Full content with attachments
2. Reaction summary + add reaction
3. Comments section
4. Mark as read automatically on view

### Filters
- By category
- By child (if multiple children)
- Unread only

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Parent read rate | > 80% within 24 hours |
| Average reaction rate | > 30% of readers |
| Comment engagement | > 10% of readers |
| Teacher post approval time | < 4 hours |

---

## Out of Scope (Future)

- Push notifications (separate feature)
- Direct messaging between parents and teachers
- Video conferencing integration
- Multi-language translation
- Post templates

---

## Dependencies

- @task-8: Database migration (schema ready)
- @task-9: Campus domain module
- File upload service (for attachments)

---

## Open Questions

1. Should comments support @mentions?
2. Should parents be able to share posts externally?
3. Maximum attachment file size per post?
4. Should urgent posts trigger push notifications?

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-07 | Claude | Initial PRD |


---

## Database Schema Design

### Post Model (Enhanced)

```prisma
model Post {
  id        String    @id @default(uuid()) @db.Uuid
  authorId  String    @map("author_id") @db.Uuid
  title     String    @db.VarChar(200)
  content   String?   @db.Text
  status    String    @default("DRAFT")  // DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, PUBLISHED, ARCHIVED
  publishAt DateTime? @map("publish_at") @db.Timestamptz(6)
  
  // Approval workflow
  requiresApproval Boolean @default(true) @map("requires_approval")
  
  // Pin/Featured
  isPinned    Boolean   @default(false) @map("is_pinned")
  pinnedUntil DateTime? @map("pinned_until") @db.Timestamptz(6)
  pinnedById  String?   @map("pinned_by_id") @db.Uuid
  
  // Expiration
  expiresAt DateTime? @map("expires_at") @db.Timestamptz(6)
  
  // Soft delete
  isDeleted Boolean   @default(false) @map("is_deleted")
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
  
  // Campus scoping
  campusId String @map("campus_id") @db.Uuid
  
  // Relations
  campus            Campus              @relation(...)
  author            User                @relation(...)
  audiences         PostAudience[]
  attachments       Attachment[]
  categories        PostCategoryLink[]
  reactions         PostReaction[]
  comments          PostComment[]
  readReceipts      PostReadReceipt[]
  approvalRequests  PostApprovalRequest[]
  contentHistory    PostHistory[]
  statusHistory     PostHistoryStatus[]
  
  // Indexes for feed queries
  @@index([campusId, status, publishAt])
  @@index([campusId, isPinned])
}
```

### PostCategory Model (NEW)

```prisma
model PostCategory {
  id       String  @id @default(uuid()) @db.Uuid
  campusId String  @map("campus_id") @db.Uuid
  name     String  @db.VarChar(50)
  color    String  @db.VarChar(7)  // Hex color
  icon     String? @db.VarChar(50) // Emoji or icon name
  order    Int     @default(0)
  isActive Boolean @default(true) @map("is_active")
  
  campus Campus             @relation(...)
  posts  PostCategoryLink[]
  
  @@unique([campusId, name])
  @@index([campusId, isActive])
  @@map("post_category")
}

model PostCategoryLink {
  postId     String @map("post_id") @db.Uuid
  categoryId String @map("category_id") @db.Uuid
  
  post     Post         @relation(...)
  category PostCategory @relation(...)
  
  @@id([postId, categoryId])
  @@map("post_category_link")
}
```

### PostReaction Model (NEW)

```prisma
model PostReaction {
  id     String @id @default(uuid()) @db.Uuid
  postId String @map("post_id") @db.Uuid
  userId String @map("user_id") @db.Uuid
  type   String // LIKE, LOVE, HAHA, WOW, SAD
  
  post Post @relation(...)
  user User @relation(...)
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  @@unique([postId, userId])  // One reaction per user per post
  @@index([postId, type])     // For counting by type
  @@map("post_reaction")
}
```

### PostComment Model (NEW)

```prisma
model PostComment {
  id      String  @id @default(uuid()) @db.Uuid
  postId  String  @map("post_id") @db.Uuid
  userId  String  @map("user_id") @db.Uuid
  content String  @db.VarChar(1000)
  
  // Soft delete
  isDeleted Boolean   @default(false) @map("is_deleted")
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
  deletedBy String?   @map("deleted_by") @db.Uuid  // Who deleted (author, admin, self)
  
  post Post @relation(...)
  user User @relation(...)
  
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  
  @@index([postId, createdAt])
  @@index([userId])
  @@map("post_comment")
}
```

### PostReadReceipt Model (NEW)

```prisma
model PostReadReceipt {
  id     String @id @default(uuid()) @db.Uuid
  postId String @map("post_id") @db.Uuid
  userId String @map("user_id") @db.Uuid
  
  post Post @relation(...)
  user User @relation(...)
  
  readAt DateTime @default(now()) @map("read_at") @db.Timestamptz(6)
  
  @@unique([postId, userId])  // One receipt per user per post
  @@index([postId])
  @@map("post_read_receipt")
}
```

### PostApprovalRequest Model (NEW)

```prisma
model PostApprovalRequest {
  id     String @id @default(uuid()) @db.Uuid
  postId String @map("post_id") @db.Uuid
  
  // Submission
  submittedById String   @map("submitted_by_id") @db.Uuid
  submittedAt   DateTime @default(now()) @map("submitted_at") @db.Timestamptz(6)
  
  // Review
  status       String    @default("PENDING")  // PENDING, APPROVED, REJECTED
  reviewedById String?   @map("reviewed_by_id") @db.Uuid
  reviewedAt   DateTime? @map("reviewed_at") @db.Timestamptz(6)
  reviewNote   String?   @map("review_note") @db.Text  // Required for rejection
  
  // Snapshot of post content at submission time
  titleSnapshot   String  @map("title_snapshot") @db.VarChar(200)
  contentSnapshot String? @map("content_snapshot") @db.Text
  
  post        Post  @relation(...)
  submittedBy User  @relation("ApprovalSubmitter", ...)
  reviewedBy  User? @relation("ApprovalReviewer", ...)
  
  @@index([postId, submittedAt])
  @@index([status, submittedAt])  // For pending approval queue
  @@map("post_approval_request")
}
```

### CampusSetting Model (NEW)

```prisma
model CampusSetting {
  id       String @id @default(uuid()) @db.Uuid
  campusId String @unique @map("campus_id") @db.Uuid
  
  // Post settings
  requireTeacherApproval Boolean @default(true) @map("require_teacher_approval")
  maxPinnedPosts         Int     @default(3) @map("max_pinned_posts")
  allowParentComments    Boolean @default(true) @map("allow_parent_comments")
  allowReactions         Boolean @default(true) @map("allow_reactions")
  
  campus Campus @relation(...)
  
  @@map("campus_setting")
}
```

---

## Approval State Machine

```
                                   ┌─────────────┐
                                   │    DRAFT    │
                                   └──────┬──────┘
                                          │ submit()
                                          ▼
                               ┌──────────────────────┐
                               │  PENDING_APPROVAL    │◄─────────┐
                               └──────────┬───────────┘          │
                                          │                      │
                        ┌─────────────────┴─────────────────┐    │
                        │                                   │    │
                        ▼                                   ▼    │
               ┌────────────────┐                 ┌─────────────┐│
               │    APPROVED    │                 │  REJECTED   ││
               └───────┬────────┘                 └──────┬──────┘│
                       │ publish()                       │       │
                       ▼                            edit + resubmit
               ┌────────────────┐                        │       │
               │   PUBLISHED    │                        └───────┘
               └───────┬────────┘
                       │ archive()
                       ▼
               ┌────────────────┐
               │    ARCHIVED    │
               └────────────────┘
```

### Transitions

| From | To | Action | Who Can |
|------|-----|--------|---------|
| DRAFT | PENDING_APPROVAL | submit() | Author |
| DRAFT | PUBLISHED | publish() | Admin (bypass approval) |
| PENDING_APPROVAL | APPROVED | approve() | Admin |
| PENDING_APPROVAL | REJECTED | reject(reason) | Admin |
| REJECTED | PENDING_APPROVAL | resubmit() | Author (after edit) |
| APPROVED | PUBLISHED | publish() | Author or System (scheduled) |
| PUBLISHED | ARCHIVED | archive() | Author or Admin |
