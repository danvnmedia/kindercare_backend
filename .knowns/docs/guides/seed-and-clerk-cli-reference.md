---
title: Seed And Clerk CLI Reference
description: Operator reference for database seed helpers, guardian Clerk provisioning, tenant-wide Clerk wipe commands, environment loading, ordering, recovery, and destructive-operation safeguards.
createdAt: '2026-07-12T16:24:48.991Z'
updatedAt: '2026-07-12T16:24:48.991Z'
tags:
  - guide
  - cli
  - seed
  - clerk
  - dev-data
  - destructive-operations
---

# Seed And Clerk CLI Reference

## Purpose

This is the operator reference for backend database seeds, optional development fixtures, guardian Clerk provisioning, and the destructive tenant-wide Clerk wipe command.

Use this page for command order and safety boundaries. For full environment setup, see @doc/guides/backend-dev-deployment. The approved behavior is defined by @doc/specs/2026-07-12/clerk-dev-guardian-provisioning-and-tenant-wipe.

## Safety Boundaries

| Command family | Database | Clerk | Production |
| --- | --- | --- | --- |
| Baseline and optional database seeds | Reads/writes | No calls | Deployment-dependent |
| Guardian Clerk provisioning | Reads/writes guardian and User mappings | Creates/reuses marked users | Permanently refused |
| Clerk tenant wipe | No access | Reads all users; confirmed mode deletes all users | Permanently refused |
| Dev-data verification | Destructively exercises a disposable database | No calls | Do not use against production data |

The tenant wipe is broader than seed cleanup. It targets every user in the configured Clerk tenant, including guardians, staff, administrators, and unrelated test accounts.

## Recommended Development Order

```bash
npm run prisma:migrate:dev
npx prisma db seed
npm run seed:dev-data
npm run seed:provision-guardian-clerk
```

Run Clerk provisioning only after the database fixtures exist.

## Database Seed Commands

### Baseline Seed

```bash
npx prisma db seed
```

Creates or updates:

- three standard campuses;
- the global Super Admin role;
- system permissions;
- Super Admin permission grants.

It is database-only and does not create a login user or call Clerk.

### Student Fixtures

```bash
npm run seed:students
```

Creates 66 deterministic students plus the grade, school-year, class, `SchoolYearEnrollment`, and `Enrollment` rows used to derive representative `ACTIVE`, `WAITING`, `DEFERRED`, `COMPLETED`, `GRADUATED`, and `WITHDRAWN` phases.

Configuration:

| Variable | Purpose |
| --- | --- |
| `SEED_STUDENTS_CAMPUS_ID` | Target campus; defaults to the standard My Dinh campus. |
| `SEED_STUDENTS_CSV` | Optional path override for the student fixture CSV. |

### Guardian Fixtures

```bash
npm run seed:guardians
```

Requires the student fixtures. Creates:

- 15 deterministic guardian profiles;
- 21 same-campus guardian/student links;
- relationship types in this exact order: `Ông`, `Bà`, `Bố`, `Mẹ`, `Anh`, `Chị`, `Cô`, `Dì`, `Chú`, `Bác`.

This command is database-only and preserves guardian `userId` values created by later Clerk provisioning. `SEED_PARENT_CLERK_UID` is a legacy database-only override for the primary fixture; it does not call Clerk.

### Combined Development Fixtures

```bash
npm run seed:dev-data
```

Runs the student and guardian stages in dependency order. It remains database-only.

### Health Center Demo Fixtures

```bash
npm run seed:health-center
```

Creates deterministic Health Center demonstration data, including a nurse-like database identity/staff profile, academic references, two students, enrollments, a health profile, checkups, instructions, and health events. Its seeded UID is not a real Clerk login.

### Dev-Data Verification

```bash
SEED_VERIFY_ALLOW_MUTATION=true npm run seed:verify-dev-data
```

Runs the optional seed twice and verifies fixture idempotency, lifecycle projections, exact relationship ordering, guardian links, campus isolation, and sequence integrity.

This mutates the configured database. Use only a disposable migrated database.

## Provision Clerk Accounts For Guardian Fixtures

Required environment:

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | Must not be `production`. |
| `CLERK_SECRET_KEY` | Selects the disposable Clerk development/test tenant. |
| `SEED_CLERK_GUARDIAN_PASSWORD` | Shared password supplied at runtime for all 15 guardian accounts. Never commit or log it. |
| `SEED_STUDENTS_CAMPUS_ID` | Optional campus selection matching the database fixture seed. |

Example PowerShell setup:

```powershell
$env:NODE_ENV = "development"
$env:CLERK_SECRET_KEY = "sk_test_..."
$env:SEED_CLERK_GUARDIAN_PASSWORD = "<development-only-password>"
npm run seed:provision-guardian-clerk
```

Behavior:

- preflights all 15 database guardian fixtures before making Clerk calls;
- processes fixtures sequentially;
- creates Clerk users with stable family/campus/seed-key markers;
- reuses only users carrying the exact expected marker;
- refuses unmarked or differently marked same-email users;
- creates or repairs internal `User.clerkUid` mappings;
- links existing guardian profiles without replacing their IDs;
- stops on the first failure while preserving earlier successes;
- resumes idempotently on rerun.

The provisioning npm script uses the current process environment. Unlike the wipe launcher, it does not require `.env.local`.

## Preview Or Wipe The Clerk Tenant

### Required `.env.local`

The wipe npm launcher requires this repository-root file:

```env
NODE_ENV=development
CLERK_SECRET_KEY=sk_test_...
```

`.env.local` is git-ignored. The launcher uses Node's native `--env-file=.env.local` option and fails before starting if the file is missing.

Explicitly exported process variables take precedence over values in the file. In particular, an exported `NODE_ENV=production` cannot be weakened by `.env.local`.

### Preview

```bash
npm run clerk:wipe-all-users
```

Preview is the default. It paginates through every Clerk tenant user, reports the discovered count, and performs no deletion.

### Confirmed Execution

```bash
npm run clerk:wipe-all-users -- -- --execute --confirm DELETE_ALL_CLERK_USERS
```

The first two `--` tokens are npm forwarding separators. The script receives the final exact `--execute --confirm DELETE_ALL_CLERK_USERS` arguments.

Confirmed execution:

- enumerates all pages before deleting;
- attempts every discovered user sequentially;
- continues after individual deletion failures;
- reports discovered, deleted, and failed totals;
- reports every failed Clerk user ID;
- exits non-zero when any deletion fails;
- succeeds with zero counts for an empty tenant;
- never queries or mutates the application database.

There is no production override.

## State After A Clerk Wipe

The wipe leaves all application database rows unchanged. Internal `User`, `Guardian`, `Staff`, roles, and profiles can therefore reference Clerk UIDs that no longer exist.

To recreate and repair the 15 guardian fixture identities:

```bash
npm run seed:provision-guardian-clerk
```

This repairs guardian fixture mappings only. Staff, administrators, and unrelated identities require their normal provisioning or reconciliation workflows.

## Troubleshooting

| Symptom | Meaning and action |
| --- | --- |
| `node: .env.local: not found` | Create the repository-root `.env.local` before running the wipe command. |
| Production-disabled error | Expected hard refusal. Use a disposable development/test tenant and a non-production process environment. |
| Missing `CLERK_SECRET_KEY` | Add it to wipe `.env.local`, or export it for guardian provisioning. |
| Missing `SEED_CLERK_GUARDIAN_PASSWORD` | Export the guardian seed password before provisioning. |
| Guardian fixture missing | Run `npx prisma db seed` and `npm run seed:dev-data` first with the same campus selection. |
| Unmarked Clerk email conflict | Do not attach automatically. Resolve the unrelated Clerk user or use a clean disposable tenant. |
| Partial guardian provisioning | Fix the cause and rerun; completed accounts and links are reused. |
| Partial wipe failure | Review every reported failed user ID, preview the remaining tenant, then rerun confirmed execution if appropriate. |
| Destructive flags are not forwarded | Use the documented double npm separator: `-- -- --execute ...`. |

## Related References

- @doc/guides/backend-dev-deployment
- @doc/specs/2026-07-12/clerk-dev-guardian-provisioning-and-tenant-wipe
- @doc/architecture/identity-and-clerk-integration
- @doc/patterns/saga-pattern
