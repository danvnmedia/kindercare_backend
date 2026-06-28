-- Migration: add_audit_event
-- Spec: @doc/specs/admin-audit-log
--
-- Introduces the AuditEvent table that backs the 19-action admin audit log
-- (FR-1, FR-2). actor_id / target_id / campus_id are intentionally bare
-- UUIDs (no FK) so audit rows survive hard delete of referenced entities
-- (Scenario 4). Integrity is enforced at write time by the application
-- layer (AuditEventRecorder, @task-9cpd5c).
--
-- Defaults follow Prisma annotation conventions for this repo:
--   - id has no DB default (`@default(uuid())` is generated client-side)
--   - created_at uses CURRENT_TIMESTAMP (matches `@default(now())`)
--   - visibility uses 'ADMIN' literal default (matches `@default("ADMIN")`)
--   - context has no default (Prisma `Json` non-nullable; recorder always populates)
--
-- Three composite indexes cover the two read paths (by-target, by-actor) and
-- the campus-feed path required by future deferred-v2 work. created_at DESC
-- aligns with the timeline-feed access pattern. (AC-10.)
--
-- Forward-only — Prisma has no native down-migration. Manual rollback:
--   DROP TABLE IF EXISTS "audit_event";  -- cascades the three indexes
-- After applying, remove the AuditEvent model from prisma/schema.prisma and
-- run `npx prisma generate`.

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "before_value" JSONB,
    "after_value" JSONB,
    "context" JSONB NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'ADMIN',
    "campus_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_target_type_target_id_created_at_idx" ON "audit_event"("target_type", "target_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_actor_id_created_at_idx" ON "audit_event"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_event_campus_id_created_at_idx" ON "audit_event"("campus_id", "created_at" DESC);
