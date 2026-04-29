---
id: 9aa6hm
title: Clerk saga pattern for identity-linked entity updates
layer: project
category: pattern
tags:
  - clerk
  - saga
  - user-management
  - compensation
createdAt: '2026-04-21T16:07:10.611Z'
updatedAt: '2026-04-21T16:07:10.611Z'
---

When updating an entity whose identity fields (email/phone/fullName) are mirrored in Clerk, use the saga pattern: (1) detect Clerk-relevant changes into a `ClerkChanges` object; (2) snapshot `ClerkOriginalValues` for rollback; (3) update Clerk FIRST via `identityPort.updateUser`; (4) run DB tx via `UnitOfWorkPort.run`; (5) if DB fails, call `revertClerkChanges(clerkUid, originalValues, appliedChanges)` — best-effort, only reverts fields that were applied. Skip the saga entirely when entity has no linked userId or no Clerk-relevant fields changed. Reference: `src/application/user-management/use-cases/guardian/update-guardian.use-case.ts` and `src/application/user-management/use-cases/staff/update-staff.use-case.ts`. IdentityService already implements `replacePrimaryEmail` + `replacePrimaryPhone` — infra layer needs no changes to support new entities following this pattern.
