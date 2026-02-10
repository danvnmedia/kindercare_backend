---
id: q48axl
title: Fix auth race condition on fast page refresh
status: done
priority: high
labels:
  - bug
  - auth
  - frontend
createdAt: '2026-01-14T20:32:16.383Z'
updatedAt: '2026-01-15T03:39:29.717Z'
timeSpent: 6314
assignee: '@me'
---
# Fix auth race condition on fast page refresh

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When users spam CTRL+R to refresh, API calls fire before Clerk is initialized, causing 401 errors. Need to add auth-ready synchronization between Clerk and API client.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Create useAuthReady hook as single source of truth
- [x] #2 Update api-client.ts with auth-ready promise gate
- [x] #3 Create AuthReadyProvider component to signal auth state
- [x] #4 Update useCampusList and other hooks with enabled gate
- [x] #5 Test fast refresh no longer causes 401 errors
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation Plan

### Architecture Design
Enterprise pattern: Auth-ready state manager with React hook + API client integration

### Files to Create
1. `src/lib/auth-ready.ts` - Singleton auth state manager (promise-based gate)
2. `src/hooks/use-auth-ready.ts` - React hook for components
3. `src/components/auth-ready-provider.tsx` - Signals auth state to manager

### Files to Modify
1. `src/lib/api-client.ts` - Add waitForAuth() in getAuthToken()
2. `src/features/campuses/hooks/use-campus-list.ts` - Add enabled: isAuthReady
3. `src/app/layout.tsx` - Add AuthReadyProvider after ClerkProvider

### Implementation Order
1. Create auth-ready.ts (no dependencies)
2. Create use-auth-ready.ts (depends on Clerk)
3. Modify api-client.ts (depends on auth-ready.ts)
4. Create auth-ready-provider.tsx (depends on auth-ready.ts + Clerk)
5. Modify use-campus-list.ts (depends on use-auth-ready.ts)
6. Modify layout.tsx (integrate AuthReadyProvider)
7. Test fast refresh behavior
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Summary
Fixed race condition where fast page refreshes caused 401 errors by implementing an auth-ready synchronization pattern.

## Root Cause
API calls were firing before Clerk finished initializing, causing requests to go out without auth tokens.

## Solution Architecture
Implemented enterprise-grade auth-ready pattern with:
1. **Singleton State Manager** (auth-ready.ts) - Promise-based gate with listener pattern
2. **React Hook** (use-auth-ready.ts) - useSyncExternalStore for proper React integration
3. **Provider Component** (auth-ready-provider.tsx) - Bridges Clerk state to singleton
4. **API Client Gate** - waitForAuthReady() in getAuthToken()
5. **Query-Level Gates** - enabled: isAuthReady in React Query hooks

## Files Created
- src/lib/auth-ready.ts - Auth state singleton with promise gate
- src/hooks/use-auth-ready.ts - React hook for auth readiness
- src/components/auth-ready-provider.tsx - Clerk to singleton bridge

## Files Modified
- src/lib/api-client.ts - Added waitForAuthReady() in getAuthToken()
- src/features/campuses/hooks/use-campus-list.ts - Added enabled: isAuthReady
- src/features/campuses/hooks/use-user-roles.ts - Updated to use useAuthReady
- src/app/layout.tsx - Added AuthReadyProvider to provider stack
- src/hooks/index.ts - Exported new hooks

## How It Works
1. ClerkProvider initializes (async)
2. AuthReadyProvider monitors Clerk's isLoaded state
3. When Clerk is ready, setAuthLoaded() resolves the promise
4. API client waits for this promise before getting tokens
5. React Query hooks use enabled: isAuthReady to gate queries

## Testing
- TypeScript compilation: PASSED
- ESLint: PASSED (1 acceptable console.error warning)
- Build: Failed due to unrelated gt-next API key issue



## Follow-up Fix: isPending vs isLoading

Found additional bug after testing:
- When React Query has `enabled: false`, `isLoading` is `false` (not loading because disabled)
- But `isPending` is `true` (query hasn't run yet)
- CampusProvider was checking `isLoading` which was false, causing initialization to run with empty data
- This cleared localStorage and redirected to campus-select

Fixed by:
- Changed CampusProvider to check `isPending` instead of `isLoading`
- Now properly waits for queries to complete before initialization

Also fixed useSyncExternalStore infinite loop:
- `getServerSnapshot` was returning new object each call
- Changed to return cached `SERVER_SNAPSHOT` constant
<!-- SECTION:NOTES:END -->

