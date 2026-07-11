-- CMS category/pin integrity hardening.
-- Run after 20260710001000_add_post_approval_integrity and before deploying
-- application code that depends on the new category indexes.
-- A bounded lock wait fails deployment instead of blocking production traffic.
SET lock_timeout = '5s';
SET statement_timeout = '5min';

-- Preflight: required PostgreSQL features and expected tables.
DO $$
BEGIN
  IF current_setting('server_version_num')::int < 120000 THEN
    RAISE EXCEPTION 'CMS hardening requires PostgreSQL 12 or newer';
  END IF;
  IF to_regclass('public.post_category') IS NULL
     OR to_regclass('public.post') IS NULL
     OR to_regclass('public.role') IS NULL THEN
    RAISE EXCEPTION 'CMS hardening prerequisites are missing';
  END IF;
END $$;

-- Normalize names before enforcing case-insensitive uniqueness. Blank legacy
-- names receive a stable generated value. Later duplicates receive a short ID
-- suffix, preserving every row and every post-category link.
UPDATE post_category
SET name = CASE
  WHEN btrim(name) = '' THEN 'Category-' || substr(id::text, 1, 8)
  ELSE btrim(name)
END
WHERE name IS DISTINCT FROM CASE
  WHEN btrim(name) = '' THEN 'Category-' || substr(id::text, 1, 8)
  ELSE btrim(name)
END;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY campus_id, lower(btrim(name))
           ORDER BY created_at, id
         ) AS duplicate_number
  FROM post_category
), duplicates AS (
  SELECT pc.id,
         left(pc.name, 51) || '-' || substr(pc.id::text, 1, 8) AS replacement
  FROM post_category pc
  JOIN ranked r ON r.id = pc.id
  WHERE r.duplicate_number > 1
)
UPDATE post_category pc
SET name = duplicates.replacement
FROM duplicates
WHERE pc.id = duplicates.id;

-- Rebuild active order as one contiguous 1-based sequence per campus. Archived
-- rows retain their historical order and do not participate in active integrity.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY campus_id
           ORDER BY "order", created_at, id
         )::integer AS normalized_order
  FROM post_category
  WHERE is_archived = false
)
UPDATE post_category pc
SET "order" = ranked.normalized_order
FROM ranked
WHERE pc.id = ranked.id
  AND pc."order" IS DISTINCT FROM ranked.normalized_order;

-- Clear impossible legacy pins before constraints/triggers are installed.
UPDATE post
SET is_pinned = false,
    pinned_by_id = NULL,
    pinned_until = NULL
WHERE is_pinned = false
   OR is_deleted = true
   OR status <> 'PUBLISHED'
   OR pinned_by_id IS NULL;

-- Historical campus-scoped system flags must not retain global-admin meaning.
UPDATE role
SET is_system_role = false
WHERE is_system_role = true
  AND campus_id IS NOT NULL;

ALTER TABLE post_category
  ADD CONSTRAINT post_category_name_not_blank_check
  CHECK (btrim(name) <> '') NOT VALID,
  ADD CONSTRAINT post_category_order_positive_check
  CHECK ("order" >= 1) NOT VALID;

ALTER TABLE post
  ADD CONSTRAINT post_pin_state_check
  CHECK (
    (is_pinned = true AND pinned_by_id IS NOT NULL AND is_deleted = false AND status = 'PUBLISHED')
    OR
    (is_pinned = false AND pinned_by_id IS NULL AND pinned_until IS NULL)
  ) NOT VALID;

ALTER TABLE role
  ADD CONSTRAINT role_system_scope_check
  CHECK (is_system_role = false OR campus_id IS NULL) NOT VALID;

ALTER TABLE post_category VALIDATE CONSTRAINT post_category_name_not_blank_check;
ALTER TABLE post_category VALIDATE CONSTRAINT post_category_order_positive_check;
ALTER TABLE post VALIDATE CONSTRAINT post_pin_state_check;
ALTER TABLE role VALIDATE CONSTRAINT role_system_scope_check;

CREATE UNIQUE INDEX post_category_campus_name_ci_key
  ON post_category (campus_id, lower(btrim(name)));

CREATE UNIQUE INDEX post_category_active_order_key
  ON post_category (campus_id, "order")
  WHERE is_archived = false;

-- Defense in depth: every write that leaves PUBLISHED or enters deleted state
-- clears pin columns, including future call sites outside the CMS use cases.
CREATE OR REPLACE FUNCTION enforce_post_pin_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_deleted = true OR NEW.status <> 'PUBLISHED' THEN
    NEW.is_pinned := false;
    NEW.pinned_by_id := NULL;
    NEW.pinned_until := NULL;
  ELSIF NEW.is_pinned = false THEN
    NEW.pinned_by_id := NULL;
    NEW.pinned_until := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_pin_lifecycle_trigger ON post;
CREATE TRIGGER post_pin_lifecycle_trigger
BEFORE INSERT OR UPDATE OF status, is_deleted, is_pinned, pinned_by_id, pinned_until
ON post
FOR EACH ROW
EXECUTE FUNCTION enforce_post_pin_lifecycle();
