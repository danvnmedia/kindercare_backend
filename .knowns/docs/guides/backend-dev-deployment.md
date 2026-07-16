---
title: Backend Dev Deployment
description: Developer deployment and first-run setup guide for the Kindercare backend, including environment variables, Docker, Prisma migrations, seeds, Clerk, and admin bootstrap.
createdAt: '2026-06-13T16:03:16.017Z'
updatedAt: '2026-07-14T17:42:55.114Z'
tags:
  - guide
  - deployment
  - dev-setup
  - docker
  - prisma
  - clerk
  - seed
---

# Backend Dev Deployment

This guide is the canonical first-run and dev deployment checklist for the Kindercare backend. It covers the local developer path, Docker Compose path, production-like Compose path, seed data, Clerk setup, and common deployment traps.

Use this guide with the architecture references at the end. Do not rely on the root `README.md` alone; a few commands there are stale in the current checkout.

## Runtime Stack

| Component | Current repo expectation |
| --- | --- |
| API runtime | NestJS on Node.js. Use Node 22 to match both Dockerfiles. |
| Database | PostgreSQL 15+. Later migrations use `NULLS NOT DISTINCT`, so older PostgreSQL versions are not acceptable. |
| ORM | Prisma, schema at `prisma/schema.prisma`, migrations under `prisma/migrations/`. |
| Queue | Redis 7 through Bull/BullMQ. `QueueModule` is loaded by `AppModule`. |
| Authentication | Clerk. The backend verifies Clerk session tokens and stores only `clerkUid` on `User`. |
| File storage | Local storage adapter by default, using `UPLOAD_DIR` and `BASE_URL`. |
| API docs | Swagger UI at `/docs`; application routes are prefixed with `/api`. |

## Current Repo Reality Checks

- npm identity is `kindercare-backend`; the package is private and proprietary (`UNLICENSED`).
- Application database configuration is a complete `DATABASE_URL`; the app Compose stacks do not initialize or rename databases.

These details matter when deploying from this checkout:

- The app Compose stacks provide `app` and `redis`. PostgreSQL is external and must be reachable through `DATABASE_URL`.
- `docker-compose.db.yml` is an optional fully local fallback with `postgres` and `redis`; it is not used by the app Compose stacks.
- The canonical baseline seed command is `npx prisma db seed`. Optional development fixtures use `npm run seed:students`, `npm run seed:guardians`, or `npm run seed:dev-data`.
- `npm run clerk:get-token` points to `scripts/get-clerk-token.ts`, but that file is absent in this checkout.
- `npm run test:e2e` points to `test/jest-e2e.json`, but the `test/` folder is absent in this checkout.
- The actual compiled entrypoint is `dist/src/main.js`. `docker-compose.prod.yml` uses that path. `package.json` currently has `start:prod` as `node dist/main`, which does not match the build output.
- There is no dedicated `/health` endpoint in the current API. Use `/docs`, Prisma checks, logs, or a minimal authenticated endpoint for smoke testing.

## Environment Variables

Create `.env` from `.env.example`, then fill in all values required by the deployment mode. `.env` is ignored by git and must not be committed.

Prisma CLI loads repository-root `.env` for migrations and the baseline seed. Direct TypeScript database seed and admin npm launchers preload `dotenv/config`; exported or container-injected values take precedence, and an injected `DATABASE_URL` continues to work when no `.env` file exists inside the container. Guardian provisioning and Clerk wipe use Node's native `--env-file=.env` launcher and require the file for host execution.

The application uses a complete `DATABASE_URL` connection string in every execution mode. The app Compose stacks pass that value through unchanged and do not start a PostgreSQL container. This keeps hosted-provider credentials, TLS options, host, port, and database name in one provider-issued value.

`docker-compose.db.yml` remains an explicit local-only fallback. The official PostgreSQL image requires `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` to initialize its own server; those settings are not application database configuration and are not needed for Neon.

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | Recommended | Runtime/process | Use `development` locally. Use `production` for production-like runs. |
| `APP_PORT` | Yes | `src/main.ts`, Compose port mapping | The Nest app listens on this. Default is `3000`. |
| `DEBUG_PORT` | Dev only | Docker Compose | Exposes Node debug port for dev Compose. Default is `9229`. |
| `DATABASE_URL` | Yes | Prisma, `entrypoint.sh`, app Compose stacks | Complete PostgreSQL URL. It must be reachable from the host or app container and should include provider-required TLS options. |
| `POSTGRES_USER` | Local fallback only | `docker-compose.db.yml` | Optional override for the standalone local PostgreSQL container. |
| `POSTGRES_PASSWORD` | Local fallback only | `docker-compose.db.yml` | Optional override for the standalone local PostgreSQL container. |
| `POSTGRES_DB` | Local fallback only | `docker-compose.db.yml` | Optional override for the standalone local PostgreSQL container. |
| `POSTGRES_PORT` | Local fallback only | `docker-compose.db.yml` | Optional host port override; defaults to `5432`. |
| `REDIS_HOST` | Yes | `QueueModule` | Use `localhost` on host. App Compose stacks override it to `redis`. |
| `REDIS_PORT` | Yes | `QueueModule`, Compose | Default is `6379`. |
| `REDIS_PASSWORD` | Optional | `QueueModule`, Redis service | Empty is allowed locally. If set, both app and Redis service must use it. |
| `CORS_ORIGIN` | Recommended | `src/main.ts` | Frontend origin. If empty, code falls back to permissive `true`. |
| `CLERK_SECRET_KEY` | Required for auth/admin | Clerk client and admin CLI | Needed for token verification and automatic admin user creation. |
| `CLERK_PUBLISHABLE_KEY` | Required for Clerk client config | Clerk client provider | Keep aligned with the same Clerk instance as the secret key. |
| `UPLOAD_DIR` | Optional | Local storage adapter | Defaults to `./uploads`. Persist or mount this if local files matter. |
| `BASE_URL` | Recommended | Local storage adapter | Defaults to `http://localhost:3000`. Set to the externally reachable API base URL. |
| `STORAGE_BUCKET` | Optional | File upload use case | Stored on file records when no request-level bucket is supplied. |
| `SKIP_CLERK` | Temporary local only | Admin CLI | If `true`, admin CLI creates a temporary DB-only Clerk UID. The user cannot log in through real Clerk with that UID. |
| `CLI_COMMAND` | Optional | Admin CLI | Internal command override. Normally use script arguments instead. |

### Host `.env` Example

Use this when running Nest directly on the host:

```env
NODE_ENV="development"
APP_PORT=3000
DEBUG_PORT=9229
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
CORS_ORIGIN="http://localhost:3000"
BASE_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
STORAGE_BUCKET="kindercare-local"
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
```

### Compose App `.env` Example

Use the same complete database URL when the app runs inside Docker Compose:

```env
NODE_ENV="development"
APP_PORT=3000
DEBUG_PORT=9229
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
CORS_ORIGIN="http://localhost:3000"
BASE_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
STORAGE_BUCKET="kindercare-local"
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
```

The app Compose stacks require `DATABASE_URL` and pass it through unchanged. They override `REDIS_HOST` to the internal `redis` service. For Neon, use the pooled `-pooler` URL for application traffic. A separate direct connection URL can be introduced later for migration tooling if operational experience requires it.

## Local Development With Docker Compose

This setup runs the app and Redis in Docker while PostgreSQL is supplied through `DATABASE_URL` (for example, Neon).

1. Create and fill `.env`.

   ```bash
   cp .env.example .env
   ```

2. Set `DATABASE_URL` to the complete provider-issued connection string. The database host must be reachable from the app container.

3. Start the app stack.

   ```bash
   docker compose up --build app
   ```

   The app container uses `entrypoint.sh`, waits for the database host from `DATABASE_URL`, runs `npx prisma migrate deploy`, then starts the application.

4. Seed the database after migrations complete.

   ```bash
   docker compose exec app npx prisma db seed
   ```

5. Create a Super Admin mapped to Clerk.

   ```bash
   docker compose exec app npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --password="SecurePass123!"
   ```

   If the Clerk user already exists, use the existing Clerk UID:

   ```bash
   docker compose exec app npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --clerk-uid=user_xxx
   ```

6. Open Swagger.

   ```text
   http://localhost:3000/docs
   ```

7. For protected endpoints, send both headers:

   ```http
   Authorization: Bearer <clerk-session-token>
   X-Campus-Id: 11111111-1111-4111-8111-111111111111
   ```

## Local Development Without The App Container

Use this when a developer wants hot reload directly on the host.

1. Start Redis only.

   ```bash
   docker compose up -d redis
   ```

   To use the optional fully local PostgreSQL fallback instead of a hosted URL, start `docker-compose.db.yml` and change `DATABASE_URL` to that local database explicitly:

   ```bash
   docker compose -f docker-compose.db.yml up -d
   ```

2. Keep host-style values: `REDIS_HOST` is `localhost`, and `DATABASE_URL` points to either the hosted database or the explicitly selected local fallback.

3. Install dependencies.

   ```bash
   npm install
   ```

4. Generate Prisma client.

   ```bash
   npm run prisma:generate
   ```

5. Apply migrations.

   For a development database:

   ```bash
   npm run prisma:migrate:dev
   ```

   For a deployment-like database where existing migrations should only be applied:

   ```bash
   npm run prisma:migrate:deploy
   ```

6. Seed baseline data.

   ```bash
   npx prisma db seed
   ```

7. Create the Super Admin user.

   ```bash
   npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --password="SecurePass123!"
   ```

8. Start the app.

   ```bash
   npm run start:dev
   ```

## Production-Like Docker Compose

`docker-compose.prod.yml` builds with `Dockerfile.prod`, installs production dependencies, builds the app, runs migrations through `entrypoint.sh`, and starts `node dist/src/main.js`. PostgreSQL is external and supplied exclusively through `DATABASE_URL`.

1. Supply the provider-issued database URL and the remaining production secrets through the deployment secret mechanism:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
   REDIS_HOST="redis"
   ```

2. Build and start the stack.

   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. Run seed after the app has migrated the database.

   ```bash
   docker compose -f docker-compose.prod.yml exec app npx prisma db seed
   ```

4. Create the initial Super Admin.

   ```bash
   docker compose -f docker-compose.prod.yml exec app npm run cli:create-admin -- --email=admin@example.com --name="Production Admin" --clerk-uid=user_xxx
   ```

Important production-like notes:

- `docker-compose.prod.yml` does not publish app or Redis ports. Add a port mapping or attach a reverse proxy if direct host access is needed.
- The app container runs migrations automatically on startup. Seeds are not automatic and should be run intentionally.
- `DATABASE_URL` is required and passed through unchanged; do not commit it or bake it into an image.
- The production stack does not start PostgreSQL. The configured database must be reachable from the app container.
- For Neon, the pooled `-pooler` URL is appropriate for application traffic. Consider a separate direct URL before introducing migration workloads that are incompatible with transaction pooling.

## Seed Data

Run the default bootstrap seed after migrations:

```bash
npx prisma db seed
```

The default seed is idempotent and uses `prisma/seed.ts`. It creates or updates:

| Data | Details |
| --- | --- |
| Campuses | `Kindercare My Dinh`, `Kindercare Quan 2`, `Kindercare Nam Do`. |
| Super Admin role | Global role ID `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`. |
| System permissions | Imported from `SYSTEM_PERMISSIONS`. |
| Super Admin permissions | Grants every system permission to the Super Admin role. |

Seeded campus IDs:

```text
11111111-1111-4111-8111-111111111111  Kindercare My Dinh
22222222-2222-4222-8222-222222222222  Kindercare Quan 2
33333333-3333-4333-8333-333333333333  Kindercare Nam Do
```

If `PermissionsGuard` resolves an admin user with an empty permission list, rerun the default seed.

### Optional Development Fixtures

The optional database fixtures remain separate from `npx prisma db seed`. Run the default seed first, then choose one database-only command:

```bash
npm run seed:students
npm run seed:guardians
npm run seed:dev-data
```

- `seed:students` creates 66 deterministic student profiles plus the minimal grade, school-year, class, `SchoolYearEnrollment`, and `Enrollment` rows needed to derive representative `ACTIVE`, `WAITING`, `DEFERRED`, `COMPLETED`, `GRADUATED`, and `WITHDRAWN` phases.
- `seed:guardians` requires the student fixtures. It creates 15 deterministic guardian profiles, 21 same-campus student links, and these campus-scoped relationship types in order: `Ông`, `Bà`, `Bố`, `Mẹ`, `Anh`, `Chị`, `Cô`, `Dì`, `Chú`, `Bác`.
- `seed:dev-data` runs both database stages in dependency order.
- None of these commands calls Clerk.

Database fixture configuration:

| Variable | Purpose |
| --- | --- |
| `SEED_STUDENTS_CAMPUS_ID` | Target campus; defaults to Kindercare My Dinh. |
| `SEED_STUDENTS_CSV` | Override the student fixture CSV path. |
| `SEED_PARENT_CLERK_UID` | Legacy database-only option that links the primary guardian to a supplied UID without calling Clerk. Prefer the all-guardian provisioning command below. |

Student lifecycle labels are fixture scenarios, not persisted status fields. The seed writes canonical dated enrollment rows and lets `student_with_phase` derive the phase. `isArchived` remains an independent recoverable profile-archive flag.

Fixture IDs come from immutable seed keys, so safe reruns update the same records and preserve student codes. To verify idempotency and projections against a disposable migrated database:

```bash
SEED_VERIFY_ALLOW_MUTATION=true npm run seed:verify-dev-data
```

The verifier intentionally refuses to run without `SEED_VERIFY_ALLOW_MUTATION=true` because it runs the optional seed twice.

#### Provision Clerk Accounts For All Guardian Fixtures

Clerk provisioning is a separate opt-in step. Run `seed:dev-data` first, configure a disposable Clerk development/test tenant, and set:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Must not be `production`; production is permanently refused. |
| `CLERK_SECRET_KEY` | Selects the Clerk development/test tenant. |
| `SEED_CLERK_GUARDIAN_PASSWORD` | Shared development password for all 15 fixture accounts. It is never persisted or printed. |

The host launcher loads repository-root `.env` with Node's native `--env-file=.env` option. The file is required; already exported values take precedence.

Then run:

```bash
npm run seed:provision-guardian-clerk
```

The command processes all 15 fixtures sequentially. It creates Clerk users with stable family/campus/fixture markers, creates or reuses the matching internal `User` mappings, and links each existing guardian profile. A rerun reuses only correctly marked Clerk users; an unmarked or differently marked email is a safe conflict. If a run stops partway through, completed Clerk accounts and database links remain, and a later rerun resumes.

After a Clerk tenant wipe, rerunning this command recreates the marked guardian users and replaces their stale internal Clerk UIDs without replacing guardian profiles. It does not reconcile staff, administrator, or other non-fixture identities.

#### Preview Or Delete Every User In The Clerk Tenant

The wipe command targets every user in the tenant selected by `CLERK_SECRET_KEY`, including fixture guardians, staff, administrators, and unrelated test users. Use only a disposable Clerk development/test tenant. It permanently refuses `NODE_ENV=production`.

The npm launcher requires a repository-root `.env` and loads it with Node's native environment-file support before the CLI starts. At minimum, configure:

```env
NODE_ENV=development
CLERK_SECRET_KEY=sk_test_...
```

Explicitly exported process environment variables take precedence over values in `.env`. This ensures an exported `NODE_ENV=production` can never be weakened by the file.

Preview is the default and performs no deletion:

```bash
npm run clerk:wipe-all-users
```

Execute the irreversible tenant-wide deletion only with both exact arguments. The first two `--` tokens are npm's forwarding separators; the script receives the final `--execute --confirm ...` arguments:

```bash
npm run clerk:wipe-all-users -- -- --execute --confirm DELETE_ALL_CLERK_USERS
```

The command enumerates all Clerk pages before deletion, attempts every discovered user sequentially, continues after individual failures, and reports discovered/deleted/failed totals plus all failed Clerk user IDs. Any partial failure returns a non-zero exit code; an empty tenant succeeds.

This command never queries or changes the application database. Internal `User`, `Guardian`, `Staff`, role, and profile rows remain unchanged and may point to Clerk identities that no longer exist. Guardian fixture links are repaired by rerunning `seed:provision-guardian-clerk`; other identities require their normal provisioning or reconciliation workflow.

## Admin Bootstrap And Clerk

The seed creates the Super Admin role, but it does not create a login user. Create at least one Super Admin user after seeding.

### Recommended: Create Or Reuse Clerk User

Create a Clerk user automatically and map it into the local database:

```bash
npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --password="SecurePass123!"
```

Map an existing Clerk user by UID:

```bash
npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --clerk-uid=user_xxx
```

List Super Admins:

```bash
npm run cli:list-admins
```

Delete by Clerk UID:

```bash
npm run cli:delete-admin -- --clerk-uid=user_xxx
```

### Temporary Local Bypass

Use this only if Clerk is unavailable and the developer needs a database row for local testing. The generated UID is not a real Clerk user and cannot log in through Clerk.

PowerShell:

```powershell
$env:SKIP_CLERK="true"
npm run cli:create-admin -- --email=admin@example.com --name="Local Admin"
Remove-Item Env:SKIP_CLERK
```

Bash:

```bash
SKIP_CLERK=true npm run cli:create-admin -- --email=admin@example.com --name="Local Admin"
```

## Authentication Smoke Test

The backend expects Clerk session tokens in the `Authorization` header. Public routes can run without a token, but protected routes require Clerk auth and often campus context.

Typical request shape:

```bash
curl http://localhost:3000/api/campuses \
  -H "Authorization: Bearer <clerk-session-token>" \
  -H "X-Campus-Id: 11111111-1111-4111-8111-111111111111"
```

Global Super Admin users can bypass campus access checks, but requests should still include `X-Campus-Id` when an endpoint expects campus context.

## Verification Checklist

Run these before handing an environment to a developer:

```bash
npm run build
npx prisma validate
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
```

For a running environment:

```bash
npx prisma migrate status
npx prisma db seed
npm run cli:list-admins
```

Then confirm:

- Swagger loads at `http://localhost:3000/docs` or the deployed equivalent.
- App logs show successful Prisma connection and no Redis connection errors.
- A protected endpoint works with a Clerk session token and `X-Campus-Id`.
- Seeded campuses exist.
- At least one Super Admin user exists and has an `isSystemRole=true` role.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Compose reports `DATABASE_URL is required` | The project `.env` is missing or the variable is empty | Create `.env` and set the complete provider-issued PostgreSQL URL. |
| Direct seed/admin reports a missing `DATABASE_URL` | Neither repository-root `.env` nor the process/container environment supplies it | Set the complete connection string in `.env`, or inject `DATABASE_URL` into the process/container. |
| App cannot connect to hosted PostgreSQL inside Compose | The database hostname is unreachable from the container, TLS options are missing, or provider access rules reject the connection | Verify the full `DATABASE_URL`, provider status/access rules, and required `sslmode` options. |
| App waits for the wrong database port | A non-default port is missing or malformed in `DATABASE_URL` | Include the explicit port; otherwise `entrypoint.sh` defaults PostgreSQL to `5432`. |
| Redis connection errors inside Compose | `REDIS_HOST` was overridden incorrectly | App Compose stacks set `REDIS_HOST=redis`; avoid overriding it with `localhost` inside the container. |
| Optional local Postgres health check fails after customization | Local container initialization values do not match the intended database/user | Set `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` only when using `docker-compose.db.yml`. |
| Protected endpoints return unauthorized | Missing or invalid Clerk keys/token | Set `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, and send a Clerk session token. |
| Admin resolves with no permissions | Seed was not run after migrations | Run `npx prisma db seed`. |
| `npm run prisma:generate` fails with Windows `EPERM` on query engine rename | Running Node/Prisma process is locking `node_modules/.prisma/client` | Stop local Nest/Prisma/Node processes and retry. |
| `npm run start:prod` fails to find `dist/main` | Script path is stale for current build output | Use `node dist/src/main.js` or the prod Compose command until the script is corrected. |
| Local file URLs do not serve bytes | Local storage returns `BASE_URL/key`, but no static file route was found | Treat file serving as incomplete for dev, or add/static-mount the storage route before relying on uploaded bytes. |

## References

- @doc/architecture/identity-and-clerk-integration
- @doc/architecture/rbac-system
- @doc/architecture/queue-and-cronjob
- @doc/architecture/file-management-and-storage
- @doc/architecture/multi-campus-architecture
- @doc/patterns/prisma-migration-patterns
- @doc/guides/seed-and-clerk-cli-reference
- [Docker Compose variable interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Prisma ORM with Neon](https://docs.prisma.io/docs/orm/v6/overview/databases/neon)
- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)

## Permission Catalog Deployment Order

Student Health and Medication Lifecycle deployments must run the permission seed after database migrations:

```bash
npm run prisma:migrate:deploy
npx prisma db seed
```

The migration removes role assignments for `medication_request.create`, `medication_request.delete`, and `medication_administration.list` before deleting those obsolete permission rows. The seed then creates or updates the canonical `SYSTEM_PERMISSIONS` catalog, including archive-only `student_health.delete`, and grants every current permission to the global Super Admin role.

Application container startup runs migrations but does not run seeds. Operators must perform the seed step intentionally on every environment receiving this permission-catalog change.
