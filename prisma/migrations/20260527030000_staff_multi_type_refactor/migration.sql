-- ============================================================================
-- Migration: staff_multi_type_refactor
-- ============================================================================
-- Replaces the single `staff.staff_type_id` scalar (1:0..1 to staff_type) with
-- a `staff_staff_type` join table so a staff member can hold 1..N concurrent
-- StaffTypes (e.g. Teacher + Vice President at the same campus), and widens
-- the `user_roles` natural-key unique from 3 columns to 4 — with
-- PostgreSQL 15+ `NULLS NOT DISTINCT` — so that multiple tracked rows (one
-- per StaffType whose `default_role_id` resolves to the same role) can
-- coexist alongside a single manual row (`granted_via_staff_type_id IS NULL`).
--
-- Source-of-truth: @doc/specs/staff-multi-type-refactor
--   - Schema delta: §"Schema delta"
--   - Migration steps: §"Migration steps (single migration directory)"
--   - Fulfills: AC-1 (table + indexes + 4-col unique), AC-2 (backfill semantics)
--
-- Locked decisions referenced:
--   - D2 — `user_roles` unique becomes `(user_id, role_id, campus_id,
--          granted_via_staff_type_id) NULLS NOT DISTINCT`. Retires the D5
--          manual-wins mechanic of @doc/specs/tracked-grant-revocation — under
--          the 4-col key, manual vs tracked rows never collide on insert.
--   - D5 — Forward migration backfills `staff_staff_type` from every
--          `staff` row where `staff_type_id IS NOT NULL`, then drops the
--          scalar column. Legacy staff with `staff_type_id IS NULL` migrate
--          to zero join rows — the next edit forces the operator to pick at
--          least one StaffType (entity-level min-1 invariant, see
--          @doc/specs/staff-multi-type-refactor D4). No sentinel
--          "Unassigned" type is introduced.
--
-- Rationale per step:
--   1. CREATE TABLE `staff_staff_type` with PK on the natural pair so the
--      same staff cannot hold the same type twice. `ON DELETE CASCADE` on
--      the staff side (standard join-table convention — hard-delete cleans
--      up links); `ON DELETE RESTRICT` on the staff_type side, mirroring the
--      existing `campus → staff_type` rule — a StaffType in use cannot be
--      hard-deleted. `StaffType.archive()` is the production removal path.
--      `created_at` is `TIMESTAMPTZ(6)` to match every other timestamp in
--      this schema.
--   2. Backfill is `SELECT ... WHERE staff_type_id IS NOT NULL` so legacy
--      NULL rows produce zero join rows — the explicit D5 mechanic. Copies
--      `staff.created_at` so the join row's `created_at` reflects when the
--      staff was originally hired, not when this migration ran. Downstream
--      ordering by `StaffType.order` happens in the mapper, not here.
--   3. `ALTER TABLE staff DROP COLUMN staff_type_id` — Postgres cascades the
--      auto-named FK constraint and the prior `@@index([staffTypeId])` so
--      no explicit DROP CONSTRAINT / DROP INDEX is needed.
--   4. The pre-existing 3-col uniqueness on `user_roles` was created as a
--      UNIQUE INDEX (not a CHECK constraint) in
--      `20260106212202_multi_campus_migration/migration.sql:121`
--      under the Prisma-default name `user_roles_user_id_role_id_campus_id_key`.
--      Drop it before recreating with provenance + NULLS NOT DISTINCT.
--   5. CREATE UNIQUE INDEX `user_roles_natural_key` with NULLS NOT DISTINCT
--      (Postgres 15+ syntax). Prisma's `@@unique` attribute cannot express
--      `NULLS NOT DISTINCT`; the matching `@@unique` in schema.prisma exists
--      only so the Prisma client knows the field tuple — the SQL-level
--      uniqueness comes from this raw index.
--
-- Backfill safety: the INSERT is idempotent given the new PK because
-- `staff.staff_type_id` is at most one type per staff today, so each source
-- row produces a unique `(staff_id, staff_type_id)` pair. Re-running this
-- migration is not supported by Prisma's forward-only model anyway.
--
-- Forward-only; Prisma has no native down-migration. The ROLLBACK block at
-- the bottom of this file is the manual undo path.
-- ============================================================================

-- ============================================================================
-- 1. CreateTable: staff_staff_type
-- ============================================================================
CREATE TABLE "staff_staff_type" (
    "staff_id"      UUID NOT NULL,
    "staff_type_id" UUID NOT NULL,
    "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "staff_staff_type_pkey" PRIMARY KEY ("staff_id", "staff_type_id"),

    CONSTRAINT "staff_staff_type_staff_id_fkey"
        FOREIGN KEY ("staff_id") REFERENCES "staff"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,

    CONSTRAINT "staff_staff_type_staff_type_id_fkey"
        FOREIGN KEY ("staff_type_id") REFERENCES "staff_type"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Reverse-lookup index for `findByStaffTypeId` and `findEligibleForClass`
-- queries (`WHERE staff_type_id = $1`). PK already covers staff-side lookups.
CREATE INDEX "staff_staff_type_staff_type_id_idx"
    ON "staff_staff_type"("staff_type_id");

-- ============================================================================
-- 2. Backfill from existing non-null staff.staff_type_id
-- ============================================================================
INSERT INTO "staff_staff_type" ("staff_id", "staff_type_id", "created_at")
SELECT "id", "staff_type_id", "created_at"
FROM "staff"
WHERE "staff_type_id" IS NOT NULL;

-- ============================================================================
-- 3. Drop the legacy scalar (cascades the auto-named FK + index)
-- ============================================================================
ALTER TABLE "staff" DROP COLUMN "staff_type_id";

-- ============================================================================
-- 4. Drop the pre-existing 3-col user_roles unique index
-- ============================================================================
-- Created in 20260106212202_multi_campus_migration/migration.sql:121 as:
--   CREATE UNIQUE INDEX "user_roles_user_id_role_id_campus_id_key"
--     ON "user_roles"("user_id", "role_id", "campus_id");
DROP INDEX "user_roles_user_id_role_id_campus_id_key";

-- ============================================================================
-- 5. Create the 4-col NULLS NOT DISTINCT replacement
-- ============================================================================
-- NULLS NOT DISTINCT treats NULL provenance values as equal for uniqueness,
-- so the index correctly forbids two manual grants `(user, role, campus)`
-- with provenance NULL while allowing multiple tracked grants whose
-- provenance differs.
CREATE UNIQUE INDEX "user_roles_natural_key"
    ON "user_roles" ("user_id", "role_id", "campus_id", "granted_via_staff_type_id")
    NULLS NOT DISTINCT;

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   -- 1. Restore the 3-col unique on user_roles
--   DROP INDEX IF EXISTS "user_roles_natural_key";
--   CREATE UNIQUE INDEX "user_roles_user_id_role_id_campus_id_key"
--     ON "user_roles"("user_id", "role_id", "campus_id");
--
--   -- 2. Restore the scalar staff_type_id (NULL for all rows initially)
--   ALTER TABLE "staff" ADD COLUMN "staff_type_id" UUID;
--
--   -- 3. Re-populate with the SINGLE most-recent type per staff (data loss
--   --    for multi-type staff is unavoidable on rollback)
--   UPDATE "staff" s
--   SET "staff_type_id" = sst."staff_type_id"
--   FROM (
--     SELECT DISTINCT ON ("staff_id") "staff_id", "staff_type_id"
--     FROM "staff_staff_type"
--     ORDER BY "staff_id", "created_at" DESC
--   ) sst
--   WHERE s."id" = sst."staff_id";
--
--   -- 4. Re-attach the FK + index that DROP COLUMN cascaded away
--   ALTER TABLE "staff" ADD CONSTRAINT "staff_staff_type_id_fkey"
--     FOREIGN KEY ("staff_type_id") REFERENCES "staff_type"("id")
--     ON DELETE SET NULL ON UPDATE CASCADE;
--   CREATE INDEX "staff_staff_type_id_idx" ON "staff"("staff_type_id");
--
--   -- 5. Drop the join table
--   DROP TABLE "staff_staff_type";
-- COMMIT;
-- After applying, revert `prisma/schema.prisma` to the prior shape and run
-- `npx prisma generate`.
