# Production deployment

This repository supports production deployment as a Vercel container using
`Dockerfile.vercel`. Vercel Container Images were released in beta on June 30,
2026, so their platform limits and beta status should be reviewed before each
major production rollout.

## Deployment model

- Pull requests and non-`main` branches can use Vercel Git preview deployments.
- Direct Vercel Git deployment is disabled for `main` in `vercel.json`.
- A successful `Backend CI` run on `main` triggers `Deploy Backend to Vercel`.
- The production workflow checks out the exact tested commit, applies Prisma
  migrations once, and then deploys that commit with Vercel CLI.
- The API container never migrates or seeds the database during startup.
- Vercel Cron calls protected HTTP endpoints. In-process NestJS schedules and
  the Bull worker are disabled in the Vercel image because instances are
  stateless and may scale to zero.

## GitHub repository settings

Create a GitHub `production` environment, protect it as appropriate, and add:

| Secret | Purpose |
| --- | --- |
| `DATABASE_URL` | Direct or migration-safe PostgreSQL URL used only by Prisma migrate |
| `VERCEL_TOKEN` | Token allowed to deploy the linked Vercel project |
| `VERCEL_ORG_ID` | Vercel account/team identifier |
| `VERCEL_PROJECT_ID` | Vercel project identifier |

Protect `main`, require the `Backend CI / quality` check, and prevent force
pushes. The deployment workflow deliberately does not receive write access to
repository contents.

## Vercel project settings

Import `danvnmedia/kindercare_backend`, set `main` as the production branch, and
configure all of these production variables:

- `NODE_ENV=production`
- `DATABASE_URL` (use a pooler and a conservative connection limit)
- `CLERK_SECRET_KEY`
- `CLERK_PUBLISHABLE_KEY`
- `CORS_ORIGIN` (comma-separated exact frontend origins)
- `BASE_URL` (the public backend URL)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_R2_BUCKET`
- `CLOUDFLARE_R2_ACCESS_KEY`
- `CLOUDFLARE_R2_SECRET_KEY`
- `R2_PUBLIC_DOMAIN` when public object URLs are used
- `CRON_SECRET` (random, at least 16 characters)
- `ENABLE_QUEUE_WORKER=false`
- `ENABLE_IN_PROCESS_CRON=false`

Do not configure `APP_PORT` on Vercel. The application listens on the platform
`PORT`, while the container defaults it to `3000`.

The medication job runs every five minutes, so the selected Vercel plan must
support that cron frequency. In the current Vercel limits this requires Pro or
Enterprise; Hobby only allows one invocation per day. All Vercel cron
expressions use UTC.

## Background jobs

The current email Bull queue is scaffolding and is not used by application
features. If it becomes part of a production path, deploy a persistent worker
with `ENABLE_QUEUE_WORKER=true` and external Redis, or migrate it to Vercel
Queues. Do not enable the Bull worker inside the autoscaled HTTP container and
assume jobs will continue while there is no HTTP traffic.

For a traditional persistent Docker deployment, set
`ENABLE_IN_PROCESS_CRON=true`. Only one scheduler instance should be elected,
or the tasks must be protected by a distributed lock.

## Release checklist

1. CI passes for the exact commit.
2. Production database backup and rollback procedure are verified.
3. Prisma migrations are reviewed for forward/backward compatibility.
4. Preview uses isolated or disposable services, never the production database.
5. `/api/health` and authenticated API smoke tests pass after deploy.
6. Vercel logs, alerts, spend limits, and rollback ownership are configured.
7. Clerk, PostgreSQL, Redis (if used), and R2 are in regions compatible with the
   selected Vercel function region.
8. Add a distributed lock before treating any non-idempotent cron operation as
   production-safe; Vercel cron delivery can overlap, duplicate, or be missed.

## Repository visibility

The target GitHub repository is public while this package is marked `private`
and `UNLICENSED`, and the README describes proprietary software. Confirm that
publishing the source publicly is intentional; otherwise change the GitHub
repository visibility to private before pushing.
