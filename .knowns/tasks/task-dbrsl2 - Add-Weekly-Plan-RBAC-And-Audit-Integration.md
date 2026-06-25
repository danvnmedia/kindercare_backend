---
id: dbrsl2
title: Add Weekly Plan RBAC And Audit Integration
status: done
priority: medium
labels:
  - from-spec
  - weekly-plan
  - rbac
  - audit
createdAt: '2026-06-18T12:26:34.065Z'
updatedAt: '2026-06-18T13:11:22.800Z'
timeSpent: 355
assignee: '@me'
spec: specs/weekly-plan-daily-schedule
fulfills:
  - AC-19
  - AC-20
order: 5
---
# Add Weekly Plan RBAC And Audit Integration

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Seed and enforce `weekly_plan.*` permissions and emit transaction-bound audit events for all mutating Weekly Plan operations in @doc/specs/weekly-plan-daily-schedule.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add `weekly_plan` module and list/read/create/update/delete permissions.
- [x] #2 Apply permission guards to all Weekly Plan routes.
- [x] #3 Add audit actions for create, copy, update, archive, and restore.
- [x] #4 Ensure audit records commit or roll back with the mutation transaction.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Extend RBAC catalog support by adding `weekly_plan` to `PermissionEntity.VALID_MODULES` and adding `weekly_plan.list/read/create/update/delete` to `SYSTEM_PERMISSIONS`, matching the meal-menu descriptions and seed sharing with Prisma.
2. Extend audit vocabulary by adding `CREATE_WEEKLY_PLAN`, `COPY_WEEKLY_PLAN`, `UPDATE_WEEKLY_PLAN`, `ARCHIVE_WEEKLY_PLAN`, and `RESTORE_WEEKLY_PLAN` to `AUDIT_ACTIONS`, `ACTION_VISIBILITY`, and the action visibility tests.
3. Add weekly-plan audit helper functions for actor id, compact snapshots, and context payloads. Update create/copy/update/archive/restore use cases to accept optional `currentUser`, call the existing weekly-plan tx mutation, then call `tx.recordAudit(...)` inside the same `unitOfWork.run` closure with before/after values where applicable.
4. Update `WeeklyPlanController` to import `CurrentUser`, `Permissions`, `PermissionsGuard`, and `User`; apply permissions to all weekly-plan routes (`list`, `read`, `create`, `update`, `delete`) and pass `currentUser` to mutating use cases. Register `PermissionsGuard` in `WeeklyPlanModule`.
5. Extend focused weekly-plan and audit tests to assert audit actions/transaction wiring and permission catalog/action visibility coverage. Verify with focused Jest, Prisma validate/generate as needed, build, Knowns validation, then check ACs only after RBAC/audit behavior is covered.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented Weekly Plan RBAC and audit integration: added `weekly_plan` permission module and list/read/create/update/delete catalog entries, enforced `weekly_plan.*` permissions on every Weekly Plan route, added weekly-plan audit actions and visibility coverage, added `weekly_plan` audit target support, and wired create/copy/update/archive/restore use cases to call `tx.recordAudit` inside the same UoW transaction closure as the mutation. Verification: focused Jest for weekly-plan use cases, audit visibility, permission catalog/entity, and audit recorder; `npx prisma validate`; `npx prisma generate --no-engine`; `npm run build`.
kn-review completed: inspected route decorators, permission catalog/module entries, audit action and target vocab, Prisma audit recorder target handling, and all weekly-plan mutating use cases. No P1/P2/P3 findings; create/copy/update/archive/restore audit calls are inside the same UoW closure as their mutation writes and focused tests cover action emission plus audit-failure propagation.
<!-- SECTION:NOTES:END -->

