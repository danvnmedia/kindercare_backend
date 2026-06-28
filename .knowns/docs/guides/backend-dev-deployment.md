---
title: Backend Dev Deployment
description: Developer deployment and first-run setup guide for the Kindercare backend, including environment variables, Docker, Prisma migrations, seeds, Clerk, and admin bootstrap.
createdAt: '2026-06-13T16:03:16.017Z'
updatedAt: '2026-06-13T16:03:16.017Z'
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

These details matter when deploying from this checkout:

- Docker Compose services are `app`, `postgres`, and `redis`. There is no `app-dev` service.
- The canonical seed command is `npx prisma db seed`. There is no `npm run prisma:seed` script.
- `npm run seed:students` currently points to `prisma/seeds/seed-students.ts`, but that file is absent. Do not include it in a deployment runbook until the script is restored.
- `npm run clerk:get-token` points to `scripts/get-clerk-token.ts`, but that file is absent in this checkout.
- `npm run test:e2e` points to `test/jest-e2e.json`, but the `test/` folder is absent in this checkout.
- The actual compiled entrypoint is `dist/src/main.js`. `docker-compose.prod.yml` uses that path. `package.json` currently has `start:prod` as `node dist/main`, which does not match the build output.
- There is no dedicated `/health` endpoint in the current API. Use `/docs`, Prisma checks, logs, or a minimal authenticated endpoint for smoke testing.

## Environment Variables

Create `.env` from `.env.example`, then fill in all values required by the deployment mode. `.env` is ignored by git and must not be committed.

| Variable | Required | Used by | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | Recommended | Runtime/process | Use `development` locally. Use `production` for production-like runs. |
| `APP_PORT` | Yes | `src/main.ts`, Compose port mapping | The Nest app listens on this. Default is `3000`. |
| `DEBUG_PORT` | Dev only | Docker Compose | Exposes Node debug port for dev Compose. Default is `9229`. |
| `DATABASE_URL` | Yes | Prisma, `entrypoint.sh` | Must be reachable from where the command runs. Use `localhost` on host, `postgres` inside Compose. |
| `POSTGRES_USER` | Compose | Postgres service | Defaults to `postgres`. If changed, update Compose health checks too. |
| `POSTGRES_PASSWORD` | Compose | Postgres service, Compose app URL | Defaults to `password` in examples. Use a real secret outside local dev. |
| `POSTGRES_DB` | Compose | Postgres service, Compose app URL | Defaults to `nestjs_boilerplate`. If changed, update Compose health checks too. |
| `POSTGRES_PORT` | Dev Compose | Host port mapping | Host-side Postgres port. Default is `5432`. |
| `REDIS_HOST` | Yes | `QueueModule` | Use `localhost` on host, `redis` inside Compose. |
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

Use this when running Nest locally on the host and only Postgres/Redis through Compose:

```env
NODE_ENV="development"
APP_PORT=3000
DEBUG_PORT=9229
DATABASE_URL="postgresql://postgres:password@localhost:5432/nestjs_boilerplate?schema=public"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
POSTGRES_DB="nestjs_boilerplate"
POSTGRES_PORT=5432
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

Use this shape when the app itself runs inside Docker Compose:

```env
NODE_ENV="development"
APP_PORT=3000
DEBUG_PORT=9229
DATABASE_URL="postgresql://postgres:password@postgres:5432/nestjs_boilerplate?schema=public"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="password"
POSTGRES_DB="nestjs_boilerplate"
POSTGRES_PORT=5432
REDIS_HOST="redis"
REDIS_PORT=6379
REDIS_PASSWORD=""
CORS_ORIGIN="http://localhost:3000"
BASE_URL="http://localhost:3000"
UPLOAD_DIR="./uploads"
STORAGE_BUCKET="kindercare-local"
CLERK_SECRET_KEY="sk_test_..."
CLERK_PUBLISHABLE_KEY="pk_test_..."
```

`docker-compose.yml` overrides the app container `DATABASE_URL` and `REDIS_HOST` to use `postgres` and `redis`. `docker-compose.prod.yml` does not override them, so production-like Compose depends on `.env` already using internal service hostnames.

## Local Development With Docker Compose

This is the simplest end-to-end setup because it runs the app, Postgres, and Redis together.

1. Create and fill `.env`.

   ```bash
   cp .env.example .env
   ```

2. Start the app stack.

   ```bash
   docker compose up --build app
   ```

   The app container uses `entrypoint.sh`, waits for Postgres, runs `npx prisma migrate deploy`, then starts `npm run start:dev`.

3. Seed the database after migrations complete.

   ```bash
   docker compose exec app npx prisma db seed
   ```

4. Create a Super Admin mapped to Clerk.

   ```bash
   docker compose exec app npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --password="SecurePass123!"
   ```

   If the Clerk user already exists, use the existing Clerk UID:

   ```bash
   docker compose exec app npm run cli:create-admin -- --email=admin@example.com --name="Dev Admin" --clerk-uid=user_xxx
   ```

5. Open Swagger.

   ```text
   http://localhost:3000/docs
   ```

6. For protected endpoints, send both headers:

   ```http
   Authorization: Bearer <clerk-session-token>
   X-Campus-Id: 11111111-1111-4111-8111-111111111111
   ```

## Local Development Without The App Container

Use this when a developer wants hot reload directly on the host.

1. Start only infrastructure services.

   ```bash
   docker compose up -d postgres redis
   ```

2. Use host-style `.env` values: `DATABASE_URL` points to `localhost`, and `REDIS_HOST` is `localhost`.

3. Install dependencies.

   ```bash
   npm install
   ```

4. Generate Prisma client.

   ```bash
   npm run prisma:generate
   ```

5. Apply migrations.

   For a fresh local dev database:

   ```bash
   npm run prisma:migrate:dev
   ```

   For a deployment-like database where migrations should only be applied:

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

`docker-compose.prod.yml` builds with `Dockerfile.prod`, installs production dependencies, builds the app, runs migrations through `entrypoint.sh`, and starts `node dist/src/main.js`.

1. Make sure `.env` uses internal Compose hosts:

   ```env
   DATABASE_URL="postgresql://postgres:password@postgres:5432/nestjs_boilerplate?schema=public"
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

- `docker-compose.prod.yml` does not publish app, Postgres, or Redis ports. Add a port mapping or attach a reverse proxy if direct host access is needed.
- The app container runs migrations automatically on startup. Seeds are not automatic and should be run intentionally.
- If `POSTGRES_USER` or `POSTGRES_DB` differ from defaults, update the hard-coded Compose health check `pg_isready -U postgres -d nestjs_boilerplate`.

## Seed Data

Run this after migrations:

```bash
npx prisma db seed
```

The seed is idempotent and uses `prisma/seed.ts`. It creates or updates:

| Data | Details |
| --- | --- |
| Campuses | `Kindercare My Dinh`, `Kindercare Quan 2`, `Kindercare Nam Do`. |
| Super Admin role | Global role ID `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`. |
| System permissions | Imported from `SYSTEM_PERMISSIONS` in `src/application/rbac/use-cases/seed-permissions.use-case.ts`. |
| Super Admin permissions | Grants every system permission to the Super Admin role. |

Seeded campus IDs:

```text
11111111-1111-4111-8111-111111111111  Kindercare My Dinh
22222222-2222-4222-8222-222222222222  Kindercare Quan 2
33333333-3333-4333-8333-333333333333  Kindercare Nam Do
```

If `PermissionsGuard` resolves an admin user with an empty permission list, rerun the seed.

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
| App cannot connect to Postgres inside Compose | `.env` uses `localhost` for a containerized app | Use `postgres` in `DATABASE_URL` when the app runs in Compose. |
| Redis connection errors inside Compose | `REDIS_HOST=localhost` in containerized app | Use `REDIS_HOST=redis`. |
| Compose Postgres health check fails after changing DB/user | Health check is hard-coded to defaults | Update `pg_isready -U postgres -d nestjs_boilerplate` in Compose. |
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
