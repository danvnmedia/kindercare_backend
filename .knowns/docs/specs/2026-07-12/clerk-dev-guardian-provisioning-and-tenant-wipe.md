---
title: Clerk Dev Guardian Provisioning And Tenant Wipe
description: Specification for opt-in Clerk provisioning of all guardian development fixtures and a guarded command that deletes every user in the configured Clerk tenant.
createdAt: '2026-07-12T12:47:16.015Z'
updatedAt: '2026-07-12T13:09:30.645Z'
tags:
  - spec
  - approved
  - clerk
  - seed
  - cli
  - destructive
---

## Overview

Add opt-in development CLI tooling that provisions Clerk accounts for all 15 deterministic guardian fixtures created by the optional dev-data seed, plus a separately invoked tenant-wide Clerk wipe command. The baseline Prisma seed and database-only dev-data seed remain free of external network side effects.

This is destructive external-provider tooling. Both provisioning and wipe operations are development-only, explicit, resumable, and testable without contacting a real Clerk tenant in normal CI.

## Locked Decisions

- D1: Tenant wipe targets every user returned by the configured Clerk tenant, not only seed-managed users.
- D2: Tenant wipe changes Clerk only. It does not delete, deactivate, unlink, or otherwise mutate internal `User`, `Guardian`, `Staff`, role, or profile records.
- D3: Tenant wipe hard-refuses when `NODE_ENV=production`, has no bypass, and requires the exact confirmation phrase `DELETE_ALL_CLERK_USERS`.
- D4: All 15 guardian fixtures receive Clerk accounts.
- D5: All guardian accounts share the development password `ChangeMe123!`.
- D6: The password is supplied through `SEED_CLERK_GUARDIAN_PASSWORD`; it is never hardcoded, persisted, or logged.
- D7: Provisioning may reuse an existing Clerk email only when the Clerk user carries the expected seed-managed marker. An unmarked email conflict fails safely.
- D8: Tenant wipe is preview-only by default. Deletion requires both `--execute` and `--confirm DELETE_ALL_CLERK_USERS`.
- D9: Tenant wipe continues after individual deletion failures, reports every failed Clerk user ID, and exits non-zero if any deletion failed.
- D10: Guardian provisioning stops on the first failure but keeps already completed accounts and database links. A later rerun resumes idempotently from seed-managed markers.

## Requirements

### Functional Requirements

#### Guardian Clerk Provisioning

- FR-1: Provide a separate opt-in CLI/package command for Clerk guardian provisioning; `npx prisma db seed` and `npm run seed:dev-data` must remain database-only.
- FR-2: Provisioning must refuse to run when `NODE_ENV=production`.
- FR-3: Provisioning must require `CLERK_SECRET_KEY` and `SEED_CLERK_GUARDIAN_PASSWORD`; blank values must fail before external or database mutation.
- FR-4: Provisioning must load the 15 canonical guardian fixtures from the optional dev-data seed and process them deterministically.
- FR-5: New Clerk users must use the guardian fixture email/full name, the environment-supplied shared password, and a stable seed-managed marker identifying the fixture seed key and fixture family.
- FR-6: Provisioning must never print or persist the password.
- FR-7: Before creating a user, provisioning must look up the fixture email. A matching seed-managed user is reused; a matching unmarked or differently marked user is a conflict and stops the run.
- FR-8: Each successfully created or reused Clerk user must be represented by an internal `User` row and linked to its guardian fixture without creating duplicate users or guardian profiles.
- FR-9: If the internal fixture user already references a deleted/old Clerk UID, rerunning provisioning after a tenant wipe must update that internal identity mapping to the newly created Clerk UID while preserving the guardian profile.
- FR-10: Processing must stop on the first guardian provisioning/linking failure, retain earlier successful accounts/links, print a resumable summary that excludes secrets, and exit non-zero.
- FR-11: A fully successful rerun must reuse all 15 seed-managed accounts and leave Clerk/database identity counts and links unchanged.

#### Tenant-Wide Clerk Wipe

- FR-12: Provide a separate CLI/package command that enumerates every user in the Clerk tenant selected by `CLERK_SECRET_KEY`, following pagination until complete.
- FR-13: The wipe command must refuse to run when `NODE_ENV=production`, even when confirmation arguments are present.
- FR-14: Without `--execute`, the command must perform a read-only preview, print the total users that would be deleted, and perform no deletion.
- FR-15: Execution must require both `--execute` and the exact case-sensitive argument `--confirm DELETE_ALL_CLERK_USERS`; missing or incorrect confirmation must fail before deletion.
- FR-16: Executed wipe must attempt to delete every enumerated Clerk user and must not query or mutate the application database.
- FR-17: Individual deletion failures must not stop remaining deletions. The final summary must report total discovered, deleted, and failed counts plus every failed Clerk user ID.
- FR-18: The executed command must exit non-zero if any user deletion fails and exit zero when every discovered user is deleted, including the zero-user case.

#### Documentation and Commands

- FR-19: Package scripts and the backend deployment guide must document the database-only dev seed, Clerk provisioning command, wipe preview, wipe execution syntax, required environment variables, irreversible scope, and database non-cleanup behavior.
- FR-20: Documentation must state that wiping Clerk leaves internal users/profile links pointing at identities that no longer exist until provisioning or another reconciliation flow repairs them.

### Non-Functional Requirements

- NFR-1: Normal automated tests must use mocked Clerk clients and must never mutate a real Clerk tenant.
- NFR-2: Live integration verification must be opt-in and limited to a disposable Clerk development/test tenant.
- NFR-3: External operations must use bounded sequential or low-concurrency processing to respect Clerk rate limits and make summaries deterministic.
- NFR-4: Logs must not expose `CLERK_SECRET_KEY`, guardian passwords, or authentication tokens.
- NFR-5: CLI failures must produce stable, actionable messages and non-zero process exit codes.
- NFR-6: Existing identity/profile split and guardian campus-scoping invariants must remain intact. See @doc/architecture/identity-and-clerk-integration and @doc/specs/2026-07-01/parent-multi-campus-existing-account.

## Acceptance Criteria

- [x] AC-1: The baseline and `seed:dev-data` commands make no Clerk API calls, while a new explicit command provisions Clerk identities for exactly all 15 guardian fixtures.
- [x] AC-2: Provisioning refuses production and missing secrets/passwords before mutation and never logs the configured password.
- [x] AC-3: A fresh provisioning run creates 15 seed-marked Clerk users, 15 internal identity mappings, and links every guardian fixture to its matching internal user.
- [x] AC-4: A second run reuses all 15 marked users with no duplicate Clerk users, internal users, or guardian profiles.
- [x] AC-5: An existing unmarked Clerk account with a fixture email causes a safe conflict with no accidental attachment.
- [x] AC-6: After Clerk users are wiped, provisioning recreates them and repairs stale internal Clerk UIDs without replacing guardian profiles.
- [x] AC-7: A mid-run provisioning failure preserves earlier successes, stops later provisioning, returns a non-zero exit, and succeeds idempotently when rerun after the cause is fixed.
- [x] AC-8: Wipe preview paginates through all tenant users, reports the total, and performs zero deletes.
- [x] AC-9: Wipe execution is impossible in production and impossible without both required execution/confirmation arguments.
- [x] AC-10: Confirmed wipe attempts every Clerk user, performs no database writes, reports discovered/deleted/failed totals and failed IDs, and exits non-zero on partial failure.
- [x] AC-11: Confirmed wipe against an empty tenant succeeds with zero counts.
- [x] AC-12: Unit/CLI tests cover provisioning success, rerun, marker conflict, stale UID repair, partial failure resume, pagination, preview, confirmation, production refusal, empty tenant, and partial deletion failure using mocked Clerk clients.
- [x] AC-13: Package scripts, deployment documentation, lint, build, targeted tests, and Knowns validation pass.

## Scenarios

### Scenario 1: Provision All Guardian Accounts

**Given** the database dev-data seed has created 15 guardian fixtures
**And** the configured Clerk tenant has no matching users
**When** the operator runs the explicit guardian Clerk provisioning command with the required environment variables
**Then** 15 seed-managed Clerk users are created
**And** every guardian is linked to its matching internal `User`
**And** no password or secret is logged.

### Scenario 2: Idempotent Provisioning Rerun

**Given** all 15 seed-managed Clerk users already exist and are linked
**When** provisioning is run again
**Then** all accounts are reused
**And** no duplicate Clerk or database identities are created.

### Scenario 3: Unmarked Email Conflict

**Given** a Clerk user with a guardian fixture email exists without the expected marker
**When** provisioning reaches that guardian
**Then** the run stops with a conflict
**And** the unrelated Clerk user is not attached or modified.

### Scenario 4: Resume After Partial Provisioning Failure

**Given** seven guardians were provisioned before the eighth failed
**When** the failure is corrected and provisioning is rerun
**Then** the first seven accounts are reused
**And** provisioning continues with the remaining guardians.

### Scenario 5: Wipe Preview

**Given** the tenant contains users across multiple Clerk result pages
**When** the wipe command runs without `--execute`
**Then** every page is read
**And** the full count is printed
**And** no user is deleted.

### Scenario 6: Confirmed Tenant Wipe

**Given** `NODE_ENV` is not `production`
**And** both execution arguments are exact
**When** the wipe command runs
**Then** every enumerated Clerk user is attempted
**And** internal database rows are unchanged
**And** a complete summary is printed.

### Scenario 7: Partial Wipe Failure

**Given** one Clerk deletion fails
**When** the confirmed wipe runs
**Then** later users are still attempted
**And** the failed user ID is reported
**And** the command exits non-zero.

### Scenario 8: Production Refusal

**Given** `NODE_ENV=production`
**When** either provisioning or tenant wipe is invoked
**Then** the command fails before reading or mutating Clerk
**And** there is no override.

### Scenario 9: Reprovision After Wipe

**Given** every Clerk user was deleted while internal users and guardian links remained
**When** guardian provisioning is rerun
**Then** new seed-managed Clerk users are created
**And** stale internal Clerk UIDs are replaced
**And** existing guardian profile IDs remain unchanged.

## Technical Notes

- Reuse the repository's Clerk client provider and identity conventions where practical; do not embed Clerk operations into the Prisma baseline seed.
- The CLI surface may add a focused service/adapter for paginated user listing and marker-aware provisioning rather than widening the application identity port with tenant-administration behavior.
- Seed markers should be machine-readable and stable across reruns.
- Database linking and Clerk creation span systems and cannot share a transaction. The locked resumable behavior deliberately avoids compensating deletion of earlier successes.
- The tenant wipe is intentionally broader than seed cleanup and must remain visibly named and separately invoked.
- Related references: @doc/architecture/identity-and-clerk-integration, @doc/patterns/saga-pattern, @doc/guides/backend-dev-deployment, and @doc/specs/2026-07-01/parent-multi-campus-existing-account.

## Task Links

- @task-o64sh7 [clerk-dev-guardian-provisioning-and-tenant-wipe-01] Add guarded Clerk guardian provisioning foundation — done
- @task-wi1vsc [clerk-dev-guardian-provisioning-and-tenant-wipe-02] Link and resume guardian Clerk identities — done
- @task-xkvdon [clerk-dev-guardian-provisioning-and-tenant-wipe-03] Add guarded tenant-wide Clerk wipe CLI — done
- @task-fjoy6c [clerk-dev-guardian-provisioning-and-tenant-wipe-04] Add cross-flow verification and operator documentation — done

## Open Questions

None.
