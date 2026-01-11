---
id: '31'
title: 'Post & CMS: Categories Feature - Use cases and API endpoints'
status: done
priority: medium
labels:
  - post
  - categories
  - use-case
  - controller
  - phase-4
createdAt: '2026-01-09T03:11:14.402Z'
updatedAt: '2026-01-10T02:11:32.329Z'
timeSpent: 39
---
# Post & CMS: Categories Feature - Use cases and API endpoints

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement complete Categories feature for Post & CMS.

**Context:**
- Categories are campus-scoped
- CRUD operations for admin users
- Categories have name, color, icon, order
- Follow existing use case patterns (see CreateClass, UpdateClass)
- Reference: @doc/patterns/use-case-pattern, @doc/patterns/controller-pattern

**Use Cases:**
1. CreatePostCategoryUseCase
2. UpdatePostCategoryUseCase
3. DeletePostCategoryUseCase (soft delete via deactivate)
4. GetAllPostCategoriesUseCase
5. ReorderPostCategoriesUseCase

**API Endpoints:**
- GET /post-categories
- POST /post-categories
- PATCH /post-categories/:id
- DELETE /post-categories/:id
- PATCH /post-categories/reorder
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CreatePostCategoryUseCase validates uniqueness within campus
- [x] #2 UpdatePostCategoryUseCase updates name, color, icon
- [x] #3 DeletePostCategoryUseCase deactivates category (soft delete)
- [x] #4 GetAllPostCategoriesUseCase returns paginated list with campus scoping
- [x] #5 ReorderPostCategoriesUseCase updates order for multiple categories
- [x] #6 PostCategoryController created with all endpoints
- [x] #7 Request DTOs created with validation (CreatePostCategoryRequest, UpdatePostCategoryRequest)
- [x] #8 Response DTO created (PostCategoryResponse)
- [x] #9 Module bindings added to ContentManagementModule
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create use cases in src/application/content-management/use-cases/category/:
   a. CreatePostCategoryUseCase:
      - Inject PostCategoryRepository
      - Validate name uniqueness in campus
      - Auto-assign order (max + 1) if not provided
      - Create and save entity
   b. UpdatePostCategoryUseCase:
      - Find existing category
      - Validate ownership (campusId match)
      - Update fields via entity method
      - Save and return
   c. DeletePostCategoryUseCase:
      - Find existing category
      - Call deactivate() on entity
      - Save (soft delete pattern)
   d. GetAllPostCategoriesUseCase:
      - Inject campus scoping
      - Return paginated list via repository
   e. ReorderPostCategoriesUseCase:
      - Accept array of {id, order}
      - Validate all belong to same campus
      - Batch update orders
2. Create DTOs in src/infra/http/dtos/content-management/category/:
   - CreatePostCategoryRequest: name (required), color, icon
   - UpdatePostCategoryRequest: name?, color?, icon?
   - ReorderPostCategoriesRequest: items: {id, order}[]
   - PostCategoryResponse: id, campusId, name, color, icon, order, isActive, createdAt
3. Create PostCategoryController:
   - GET / - findAll with campus header
   - POST / - create
   - PATCH /:id - update
   - DELETE /:id - deactivate
   - PATCH /reorder - reorder
4. Add to ContentManagementModule providers and repository bindings
5. Export DTOs from index
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Implementation Completed

Implemented the complete Categories feature for Post & CMS:

### Files Created:
- 5 Use Cases: CreatePostCategoryUseCase, UpdatePostCategoryUseCase, DeletePostCategoryUseCase, GetAllPostCategoriesUseCase, ReorderPostCategoriesUseCase
- 4 DTOs: CreatePostCategoryRequest, UpdatePostCategoryRequest, ReorderPostCategoriesRequest, PostCategoryResponse
- 1 Controller: PostCategoryController with 5 endpoints

### Repository Updates:
- Added reorder() method to PostCategoryRepository interface and implementation

### Module Updates:
- Added PostCategoryController, use cases, and POST_CATEGORY_REPOSITORY binding
<!-- SECTION:NOTES:END -->

