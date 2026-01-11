---
title: Frontend Multi-Campus Migration Guide
createdAt: '2026-01-10T00:00:00.000Z'
updatedAt: '2026-01-10T00:00:00.000Z'
description: >-
  PRD for frontend implementation of multi-campus architecture migration
tags:
  - prd
  - frontend
  - migration
  - multi-campus
  - phase-3
---
# PRD: Frontend Multi-Campus Migration Guide

> Complete migration guide for frontend applications to support the new federated multi-campus architecture.

## Problem

The backend has migrated from a single-school architecture to a federated multi-campus system. Frontend applications must update to:
1. Support campus context in all API requests
2. Handle new campus-scoped RBAC (Role-Based Access Control)
3. Display campus-specific data isolation
4. Implement new UI components for campus management

## Goals

- [ ] All API calls include campus context where required
- [ ] Users can switch between campuses they have access to
- [ ] Role-based UI shows permissions per campus
- [ ] Zero data leakage between campuses
- [ ] Backward-compatible with existing user flows

## Non-Goals

- Mobile app migration (separate PRD)
- Campus creation/management UI for super admins (admin panel PRD)
- Multi-language support per campus
- Campus-specific theming/branding

---

## Requirements

### Functional

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Add `X-Campus-Id` header to all campus-scoped API requests | Must |
| F2 | Implement campus selector component in app header/sidebar | Must |
| F3 | Store selected campus in global state (Redux/Context) | Must |
| F4 | Filter all list views by current campus context | Must |
| F5 | Display user's roles per campus in profile/settings | Must |
| F6 | Handle 400/403 errors for missing/invalid campus context | Must |
| F7 | Show campus name in breadcrumbs/navigation | Should |
| F8 | Persist last selected campus in localStorage | Should |
| F9 | Auto-select campus if user has access to only one | Should |
| F10 | Show campus settings for admins (approval workflow, pinning limits) | Could |

### Non-Functional

- **Performance**: Campus selector should load in <200ms
- **Security**: Never cache data from multiple campuses together; clear cache on campus switch
- **UX**: Campus switch should not require page reload; update data in-place

---

## Technical Approach

### Architecture

```
+------------------+
|   App Shell      |
|  +------------+  |
|  |Campus      |  |  <-- Campus Selector (Header)
|  |Selector    |  |
|  +------------+  |
+--------+---------+
         |
         v
+------------------+
| Campus Context   |  <-- React Context / Redux Store
| Provider         |      campusId, campusName, userRoles
+--------+---------+
         |
         v
+------------------+
| API Client       |  <-- Axios/Fetch Interceptor
| (with X-Campus-Id|      Adds header to all requests
|  header)         |
+--------+---------+
         |
         v
+------------------+
| Backend API      |
+------------------+
```

### Campus Context Header

**Header Name:** `X-Campus-Id` (case-insensitive: `x-campus-id`)

**Priority Resolution (backend):**
1. Header: `x-campus-id` (highest priority)
2. Route param: `:campusId` in URL
3. Query param: `?campusId=`

**Implementation:**

```typescript
// axios interceptor example
axios.interceptors.request.use((config) => {
  const campusId = store.getState().campus.currentCampusId;
  if (campusId) {
    config.headers['X-Campus-Id'] = campusId;
  }
  return config;
});
```

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Campus context storage | Redux + localStorage | Global access; persists across sessions |
| Header injection | Axios interceptor | Automatic; no manual addition per request |
| Campus switch behavior | Soft reload (refetch data) | Better UX than hard page reload |
| Cache invalidation | Clear on campus switch | Prevents cross-campus data leakage |

---

## API Changes Summary

### New Endpoints

| Method | Endpoint | Description | Campus Header |
|--------|----------|-------------|---------------|
| GET | `/campuses` | List all campuses (for selector) | No |
| GET | `/campuses/:id` | Get campus details | No |
| GET | `/campus-settings` | Get campus settings (approval, pinning) | **Required** |
| PATCH | `/campus-settings` | Update campus settings (admin) | **Required** |

### Modified Endpoints (Now Require Campus Header)

These endpoints now **require** the `X-Campus-Id` header:

| Category | Endpoints |
|----------|-----------|
| **Students** | `GET /students` (list) |
| **Staff** | `GET /staff` (list) |
| **Guardians** | `GET /guardians` (list) |
| **Classes** | `GET /classes` (list), `POST /classes/:id/enrollments`, `POST /classes/:id/staff` |
| **Posts** | `POST /posts`, `GET /posts`, `GET /posts/pending-approval`, `GET /posts/pinned`, `GET /posts/:id`, `PATCH /posts/:id`, `DELETE /posts/:id`, all attachment endpoints, `POST /posts/:id/heart`, `POST /posts/:id/pin` |
| **Attendance** | `POST /attendance`, `POST /attendance/bulk`, `GET /attendance/class/:classId`, `GET /attendance/student/:studentId` |
| **Reference Data** | `GET /grade-levels`, `GET /subjects`, `GET /school-years` (when listing) |

### Endpoints NOT Requiring Campus Header

These work without campus context (detail views, global operations):

| Category | Endpoints |
|----------|-----------|
| **Auth** | `/auth/*` |
| **Campus Management** | `GET /campuses`, `POST /campuses`, etc. |
| **Detail Views** | `GET /students/:id`, `GET /staff/:id`, `GET /classes/:id` |
| **Comments** | All `/comments/*` endpoints (scoped via post) |

---

## Data Model Changes

### New Fields in Responses

All campus-scoped entities now include:

```typescript
{
  campusId: string;  // UUID of the campus this entity belongs to
  // ... other fields
}
```

### Campus Response Shape

```typescript
interface Campus {
  id: string;           // UUID
  name: string;         // "Main Campus"
  address: string | null;
  phoneNumber: string | null;  // E.164 format: "+84901234567"
  isActive: boolean;
  createdAt: string;    // ISO 8601
  updatedAt: string;
}
```

### Campus Settings Response

```typescript
interface CampusSetting {
  id: string;
  campusId: string;
  requireTeacherApproval: boolean;  // Posts need admin approval
  maxPinnedPosts: number;           // 0-10
  allowParentComments: boolean;
  allowReactions: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### User Roles (Campus-Scoped)

```typescript
interface UserRoleAssignment {
  id: string;
  roleId: string;
  campusId: string | null;  // null = global role
  role: {
    id: string;
    name: string;
    permissions: Permission[];
  };
}

// User can have different roles per campus:
// - Admin at Campus A
// - Teacher at Campus B
// - Global roles (campusId: null) apply everywhere
```

### Permission Format

```typescript
interface Permission {
  id: string;           // "student.create", "post.delete"
  module: string;       // "student", "post", "class"
  description: string | null;
}

// Valid modules: campus, student, guardian, staff, class,
//   grade_level, subject, school_year, post, file, role,
//   user, attendance, staff_type, report, setting

// Valid actions: create, read, update, delete, list,
//   manage, assign, export, import
```

---

## UI Components Required

### 1. Campus Selector

**Location:** App header or sidebar

**Behavior:**
- Fetch campuses on app init: `GET /campuses`
- Filter to only show campuses user has access to
- Display current campus name
- Dropdown to switch campuses
- On switch: update context, clear cache, refetch current view data

```tsx
// Pseudo-component
<CampusSelector
  campuses={userCampuses}
  currentCampusId={selectedCampusId}
  onChange={(campusId) => {
    dispatch(setCampus(campusId));
    queryClient.invalidateQueries();  // Clear React Query cache
  }}
/>
```

### 2. Campus Context Provider

```tsx
interface CampusContextValue {
  campusId: string | null;
  campusName: string | null;
  settings: CampusSetting | null;
  userRoles: Role[];  // Roles for current campus
  hasPermission: (module: string, action: string) => boolean;
  switchCampus: (campusId: string) => void;
}
```

### 3. Role Display (User Profile)

Show user's roles grouped by campus:

```
Your Roles:
- Main Campus: Admin, Teacher
- North Campus: Teacher
- Global: Parent
```

---

## Error Handling

| HTTP Status | Error Message | Frontend Action |
|-------------|---------------|-----------------|
| 400 | "Campus context is required" | Show "Please select a campus" prompt |
| 400 | "Invalid campus ID format" | Log error; show generic error |
| 403 | "No access to this campus" | Remove campus from selector; redirect to accessible campus |
| 403 | "Campus is not active" | Show "Campus is currently inactive" message |
| 404 | "Campus not found" | Remove from selector; redirect |

**Implementation:**

```typescript
// Axios response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 400) {
      const message = error.response.data?.message;
      if (message?.includes('Campus context is required')) {
        // Show campus selector modal or redirect
        showCampusRequiredModal();
      }
    }
    if (error.response?.status === 403) {
      const message = error.response.data?.message;
      if (message?.includes('No access to this campus')) {
        // Remove campus and redirect
        dispatch(removeCampusAccess(currentCampusId));
        redirectToDefaultCampus();
      }
    }
    return Promise.reject(error);
  }
);
```

---

## Migration Checklist

### Phase 1: Infrastructure (Must)

- [ ] Add campus state to global store (Redux/Context)
- [ ] Create Axios interceptor to inject `X-Campus-Id` header
- [ ] Create `CampusProvider` context
- [ ] Add campus selector component
- [ ] Implement campus switch logic with cache invalidation

### Phase 2: API Integration (Must)

- [ ] Update all list endpoints to include campus header
- [ ] Update create forms to work with campus context
- [ ] Handle campus-specific errors (400, 403)
- [ ] Test all CRUD operations with campus context

### Phase 3: UI Updates (Should)

- [ ] Add campus name to navigation/breadcrumbs
- [ ] Show campus-scoped roles in user profile
- [ ] Add campus filter to admin dashboards
- [ ] Update search/filter components for campus scope

### Phase 4: Polish (Could)

- [ ] Persist last selected campus in localStorage
- [ ] Auto-select single campus for users with one access
- [ ] Add campus settings management UI for admins
- [ ] Add campus switching animations/transitions

---

## Edge Cases

| Scenario | Expected Behavior |
|----------|-------------------|
| User has no campus access | Show "No campus access" page; contact admin |
| User removed from campus while using | 403 on next API call; redirect to accessible campus |
| Campus deactivated while using | 403 error; show "Campus inactive" message |
| API called without campus context | 400 error; show campus selector |
| User switches campus mid-form | Warn about unsaved changes; clear form on switch |
| Token expires during campus switch | Standard auth flow; preserve campus selection |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Cross-campus data leakage | High | Clear all caches on campus switch; never cache without campus key |
| Broken existing flows | High | Thorough testing; feature flag for gradual rollout |
| Performance hit from header injection | Low | Interceptor is negligible; monitor request times |
| User confusion with multiple campuses | Med | Clear campus indicator; onboarding tooltip |

---

## Success Metrics

- All API calls include correct campus header: 100%
- Zero cross-campus data visibility bugs
- Campus switch time: <500ms
- User can complete all existing flows without errors

---

## Appendix: Full Endpoint Reference

### Campus Management

```
POST   /campuses                    Create campus (super admin)
GET    /campuses                    List all campuses
GET    /campuses/:id                Get campus by ID
PATCH  /campuses/:id                Update campus
DELETE /campuses/:id                Deactivate campus

GET    /campus-settings             Get settings [X-Campus-Id REQUIRED]
PATCH  /campus-settings             Update settings [X-Campus-Id REQUIRED]
```

### User Management (Modified)

```
GET    /students                    List students [X-Campus-Id REQUIRED]
POST   /students                    Create student (campusId in body)
GET    /students/:id                Get student details
PATCH  /students/:id                Update student
DELETE /students/:id                Delete student

GET    /staff                       List staff [X-Campus-Id REQUIRED]
POST   /staff                       Create staff (campusId in body)
GET    /staff/:id                   Get staff details
PATCH  /staff/:id                   Update staff

GET    /guardians                   List guardians [X-Campus-Id REQUIRED]
POST   /guardians                   Create guardian (campusId in body)
```

### Class Management (Modified)

```
GET    /classes                     List classes [X-Campus-Id REQUIRED]
POST   /classes                     Create class (campusId in body)
POST   /classes/:id/enrollments     Enroll student [X-Campus-Id REQUIRED]
POST   /classes/:id/staff           Assign staff [X-Campus-Id REQUIRED]
```

### Content Management (All Require Campus Header)

```
POST   /posts                       Create post [X-Campus-Id REQUIRED]
GET    /posts                       List posts [X-Campus-Id REQUIRED]
GET    /posts/pending-approval      Pending posts [X-Campus-Id REQUIRED]
GET    /posts/pinned                Pinned posts [X-Campus-Id REQUIRED]
GET    /posts/:id                   Get post [X-Campus-Id REQUIRED]
PATCH  /posts/:id                   Update post [X-Campus-Id REQUIRED]
DELETE /posts/:id                   Delete post [X-Campus-Id REQUIRED]
POST   /posts/:id/heart             Toggle reaction [X-Campus-Id REQUIRED]
POST   /posts/:id/pin               Pin post [X-Campus-Id REQUIRED]
DELETE /posts/:id/pin               Unpin post [X-Campus-Id REQUIRED]

GET    /post-categories             List categories [X-Campus-Id REQUIRED]
POST   /post-categories             Create category (campusId in body)

GET    /posts/:postId/comments      List comments (no header needed)
POST   /posts/:postId/comments      Create comment (no header needed)
POST   /comments/:id/replies        Reply to comment
PATCH  /comments/:id                Edit comment
DELETE /comments/:id                Delete comment
```

### Attendance (All Require Campus Header)

```
POST   /attendance                  Record attendance [X-Campus-Id REQUIRED]
POST   /attendance/bulk             Bulk attendance [X-Campus-Id REQUIRED]
GET    /attendance/class/:classId   Class attendance [X-Campus-Id REQUIRED]
GET    /attendance/student/:id      Student attendance [X-Campus-Id REQUIRED]
```

---

## Open Questions

- [ ] Should campus switch require confirmation if there are unsaved changes?
- [ ] Should we show a "recent campuses" quick-switch feature?
- [ ] How to handle deep links with campus context? (e.g., `/campus/abc123/students/xyz`)
- [ ] Should notifications be campus-scoped or global?
