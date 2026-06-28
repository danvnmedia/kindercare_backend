-- ============================================================================
-- Migration: subject_removal_classstaff_role_refactor
-- ============================================================================
-- Removes the half-built `subject` table entirely and reshapes `class_staff`
-- so a staff member is assigned to a class with a role rather than a subject.
--
-- Source-of-truth: @doc/specs/subject-removal-classstaff-role-refactor
--   - D1: drop Subject domain entirely (no `subject` table, no `subjectId` FK)
--   - D2: ClassStaff PK becomes (classId, staffId)
--   - D3: ClassStaffRole enum = HOMEROOM | ASSISTANT | BOARDING
--   - D5: HOMEROOM uniqueness enforced via partial unique index
--          `class_staff_homeroom_unique ON class_staff(class_id)
--           WHERE role = 'HOMEROOM'`. Prisma cannot model partial uniques,
--          so this lives only in the migration SQL.
--   - D8: pre-launch / dev data only — hard cutover, no production backfill
--
-- AC mapping: AC-1 (enum), AC-2 (model shape), AC-3 (subject dropped),
--             AC-4 (partial unique index), AC-5 (single migration, sequenced),
--             AC-6 (idempotent), AC-7 (ASSISTANT backfill applied then removed),
--             AC-8 (stale subject_id index removed), AC-9 (`prisma generate`).
--
-- Sequencing (per spec Technical Notes):
--   1. Create enum + add role column with ASSISTANT default (backfills any rows)
--   2. Drop class_staff → subject FK
--   3. Drop subject_id index, then drop subject_id column
--   4. Swap PK from (class_id, staff_id, subject_id) to (class_id, staff_id),
--      deduplicating collisions defensively (dev-only safety net per D8)
--   5. Add partial unique index `class_staff_homeroom_unique`
--   6. Drop subject FKs + table
--   7. Remove the ASSISTANT default — role is now required without default
--
-- All DROP statements are guarded with IF EXISTS for re-run safety.
-- Wrapped in a single transaction so a failure leaves the schema intact.
-- ============================================================================

BEGIN;

-- 1a. Create enum (idempotent via DO block — CREATE TYPE has no IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ClassStaffRole') THEN
    CREATE TYPE "ClassStaffRole" AS ENUM ('HOMEROOM', 'ASSISTANT', 'BOARDING');
  END IF;
END
$$;

-- 1b. Add role column with ASSISTANT default so any existing rows backfill safely
ALTER TABLE "class_staff"
  ADD COLUMN IF NOT EXISTS "role" "ClassStaffRole" NOT NULL DEFAULT 'ASSISTANT';

-- 2. Drop the class_staff → subject foreign key
ALTER TABLE "class_staff" DROP CONSTRAINT IF EXISTS "class_staff_subject_id_fkey";

-- 3a. Drop the orphaned subject_id index before dropping its column (AC-8)
DROP INDEX IF EXISTS "class_staff_subject_id_idx";

-- 3b. Dedupe (class_id, staff_id) collisions BEFORE dropping subject_id.
--     The current PK is (class_id, staff_id, subject_id) so the same staff
--     could appear twice in one class under different subjects. Keep the
--     row with the lowest ctid arbitrarily (dev-only safety per D8).
DELETE FROM "class_staff" cs
WHERE cs.ctid <> (
  SELECT MIN(inner_cs.ctid)
  FROM "class_staff" inner_cs
  WHERE inner_cs."class_id" = cs."class_id"
    AND inner_cs."staff_id" = cs."staff_id"
);

-- 3c. Swap the primary key. Drop the old composite PK, drop subject_id, then
--     create the new PK in one ALTER TABLE so the table is never PK-less mid-tx.
ALTER TABLE "class_staff"
  DROP CONSTRAINT IF EXISTS "class_staff_pkey",
  DROP COLUMN IF EXISTS "subject_id",
  ADD CONSTRAINT "class_staff_pkey" PRIMARY KEY ("class_id", "staff_id");

-- 4. Partial unique index — one HOMEROOM per class (D5)
CREATE UNIQUE INDEX IF NOT EXISTS "class_staff_homeroom_unique"
  ON "class_staff" ("class_id")
  WHERE "role" = 'HOMEROOM';

-- 5. Drop the subject table and its remaining constraints
ALTER TABLE IF EXISTS "subject" DROP CONSTRAINT IF EXISTS "subject_campus_id_fkey";
DROP TABLE IF EXISTS "subject";

-- 6. Remove the ASSISTANT default — role must be supplied explicitly going forward
ALTER TABLE "class_staff" ALTER COLUMN "role" DROP DEFAULT;

COMMIT;

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   ALTER TABLE "class_staff" ALTER COLUMN "role" SET DEFAULT 'ASSISTANT';
--   DROP INDEX IF EXISTS "class_staff_homeroom_unique";
--   CREATE TABLE "subject" (
--     "id"         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
--     "name"       TEXT        NOT NULL,
--     "campus_id"  UUID        NOT NULL REFERENCES "campus"("id") ON DELETE RESTRICT,
--     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
--     "updated_at" TIMESTAMPTZ(6) NOT NULL
--   );
--   CREATE UNIQUE INDEX "subject_campus_id_name_key" ON "subject" ("campus_id", "name");
--   CREATE INDEX "subject_campus_id_idx" ON "subject" ("campus_id");
--   ALTER TABLE "class_staff" ADD COLUMN "subject_id" UUID
--     REFERENCES "subject"("id") ON DELETE CASCADE;
--   CREATE INDEX "class_staff_subject_id_idx" ON "class_staff" ("subject_id");
--   ALTER TABLE "class_staff" DROP CONSTRAINT "class_staff_pkey";
--   ALTER TABLE "class_staff" ADD CONSTRAINT "class_staff_pkey"
--     PRIMARY KEY ("class_id", "staff_id", "subject_id");
--   ALTER TABLE "class_staff" DROP COLUMN "role";
--   DROP TYPE IF EXISTS "ClassStaffRole";
-- COMMIT;
-- Note: dropped subject rows are permanently lost (D8 hard cutover).
