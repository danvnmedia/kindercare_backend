---
title: Staff Multi-Campus Existing Account Backend Research
description: Backend research and spec-shaping notes for supporting one staff identity across multiple campus-scoped staff profiles.
createdAt: '2026-07-01T01:37:37.054Z'
updatedAt: '2026-07-10T22:05:03.556Z'
tags:
  - research
  - staff
  - multi-campus
  - identity
  - rbac
  - backend-spec
  - archived
---

# Staff Multi-Campus Existing Account Backend Research

## Result

Staff accounts are schema-capable of sharing one `User` across multiple campus-scoped `Staff` profiles, but the current backend flow does not support creating or attaching an existing staff account into another campus.

This should be a separate staff spec, not just an extension of the guardian spec, because staff access is role/RBAC-based and StaffType mutations create or revoke campus-scoped role grants.

## Current State

The schema already models `User` as the shared identity and says a user can have Guardian and/or Staff profiles at multiple campuses (`prisma/schema.prisma:234`). `Staff.userId` is optional and has `@@unique([campusId, userId])`, so one identity can have at most one staff profile per campus while still having staff profiles in multiple campuses (`prisma/schema.prisma:408`, `prisma/schema.prisma:422`).

Staff access is not derived from the Staff row alone. `UserRole` stores campus-scoped role grants and StaffType provenance (`prisma/schema.prisma:276`, `prisma/schema.prisma:294`). Campus access checks use applicable roles, not active staff profiles (`src/infra/http/context/campus-context.ts:58`). `GET /campuses` derives visible campuses from role assignments (`src/domain/user-management/user.entity.ts:299`, `src/infra/http/controllers/campus.controller.ts:70`).

`POST /staff` is a create-new-identity flow. `CreateStaffUseCase` checks campus-scoped staff uniqueness, provisions a new Clerk identity, creates a new internal `User`, creates the `Staff` profile, writes staff-type join rows, and grants StaffType default roles in the campus (`src/application/user-management/use-cases/staff/create-staff.use-case.ts:79`, `src/application/user-management/use-cases/staff/create-staff.use-case.ts:83`, `src/application/user-management/use-cases/staff/create-staff.use-case.ts:93`, `src/application/user-management/use-cases/staff/create-staff.use-case.ts:119`, `src/application/user-management/use-cases/staff/create-staff.use-case.ts:134`, `src/application/user-management/use-cases/staff/create-staff.use-case.ts:157`).

The Clerk adapter rejects an existing email or phone when provisioning (`src/infra/external-services/clerk/identity.service.ts:31`, `src/infra/external-services/clerk/identity.service.ts:39`). Therefore an existing staff account cannot currently be attached to another campus through `POST /staff`; the existing provider identity will conflict.

## Gaps For Shared Staff Identity

There is no staff attach/create-or-attach use case. Existing `StaffRepository.findByUserId(userId)` returns the first staff row for a user and there is no `findByUserIdInCampus` equivalent on the staff port (`src/application/user-management/ports/staff.repository.ts:46`, `src/infra/persistence/prisma/repositories/prisma-staff.repository.ts:106`). Shared staff identity needs campus-specific staff profile lookup.

`/auth/me` currently projects only one active guardian and one active staff profile (`src/infra/persistence/prisma/repositories/prisma-user.repository.ts:30`). That is not enough to describe a staff identity attached to several campuses if frontend or backend flows need profile selection.

Staff update syncs email, phone, and full name to Clerk when the staff has a user account (`src/application/user-management/use-cases/staff/update-staff.use-case.ts:274`, `src/application/user-management/use-cases/staff/update-staff.use-case.ts:329`). With shared identities, email/phone edits need the same restriction chosen for guardian: block global identity fields on shared identities until a dedicated verified identity-change flow exists. Full name also needs a decision: profile-local vs identity metadata.

StaffType changes already maintain StaffType-derived role grants by provenance (`src/application/user-management/use-cases/staff/update-staff.use-case.ts:429`, `src/application/user-management/use-cases/staff/update-staff.use-case.ts:519`, `src/application/user-management/use-cases/staff/update-staff.use-case.ts:548`). Any attach flow must grant the new campus roles without touching other campus grants.

Archive/restore/delete are not safe for shared staff identities today. Archive locks Clerk and sets `User.isActive = false` (`src/application/user-management/use-cases/staff/archive-staff.use-case.ts:52`, `src/application/user-management/use-cases/staff/archive-staff.use-case.ts:68`). Restore unlocks Clerk and sets `User.isActive = true` (`src/application/user-management/use-cases/staff/restore-staff.use-case.ts:61`, `src/application/user-management/use-cases/staff/restore-staff.use-case.ts:77`). Hard delete deletes the Clerk identity and internal user before deleting staff (`src/application/user-management/use-cases/staff/delete-staff.use-case.ts:46`, `src/application/user-management/use-cases/staff/delete-staff.use-case.ts:71`, `src/application/user-management/use-cases/staff/delete-staff.use-case.ts:76`). For shared staff, normal archive must be profile/campus-local, while identity lock/delete must be global and restricted.

There is an additional staff-specific hazard: if archive stops locking the global identity, campus access can still survive through existing `UserRole` grants because `hasCampusAccess` only checks roles (`src/infra/http/context/campus-context.ts:58`). The staff spec must decide whether archive revokes/restores StaffType-derived campus grants, marks grants inactive, or makes campus/permission guards require an active staff profile.

## Relationship To Guardian Spec

The guardian spec `@doc/specs/2026-07-01/parent-multi-campus-existing-account` provides useful shared identity decisions: dedicated create-or-attach endpoint, strict email+phone same-user matching, same-campus already-exists/restore behavior, blocked cross-campus details, profile-scoped archive, global identity lock/delete restricted, and shared identity email/phone edit restrictions.

Staff should reuse those identity-resolution decisions where possible, but it should not be bundled into the guardian spec. Staff has extra RBAC and StaffType-grant semantics, and archive has to remove campus access without disabling the identity globally.

## Recommended Spec Shape

Create a dedicated staff spec, likely `specs/2026-07-01/staff-multi-campus-existing-account`, and reference `@doc/archive/research/identity-profile-split-backend-research` plus the guardian spec for shared identity decisions.

Core decisions to lock:

- Dedicated endpoint, for example `POST /staff/create-or-attach`, instead of changing `POST /staff` behavior.
- Attach only when normalized email and phone both resolve to the same internal `User`; provider-only identity conflicts return manual-review conflict.
- Same-campus active staff returns already-exists; same-campus archived staff restores or returns a locked decision.
- Attach creates only a new campus-scoped `Staff` profile and StaffType/default-role grants for the target campus.
- Staff archive becomes campus/profile-scoped and must disable target-campus staff access.
- Identity lock/delete remains a global, super-admin-only operation.
- Shared staff identity email/phone changes are blocked until a dedicated verified identity-change flow exists.
- `/auth/me` either remains backward-compatible and adds profile sets, or staff gets explicit campus/profile discovery endpoints.

## Related Docs

- @doc/archive/research/identity-profile-split-backend-research
- @doc/specs/2026-07-01/parent-multi-campus-existing-account
- @doc/specs/2026-06-27/staff-type-rbac-hardening
- @doc/architecture/rbac-system
- @doc/architecture/multi-campus-architecture
