-- Preserve CMS audience targeting across workflow and class lifecycle changes.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

-- Block concurrent writes while legacy rows are normalized and constraints are
-- installed. The transaction guarantees cleanup cannot commit partially.
LOCK TABLE "class" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE post IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE post_audience IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regclass('public.post') IS NULL
     OR to_regclass('public.post_audience') IS NULL
     OR to_regclass('public.class') IS NULL THEN
    RAISE EXCEPTION 'Post audience integrity prerequisites are missing';
  END IF;
END $$;

-- ALL already grants campus-wide visibility, so any CLASS rows beside it are
-- redundant. Removing them preserves effective visibility while normalizing the
-- representation expected by the current UI and API.
DELETE FROM post_audience pa
USING (
  SELECT DISTINCT post_id
  FROM post_audience
  WHERE type = 'ALL'
) school_wide
WHERE pa.post_id = school_wide.post_id
  AND pa.type <> 'ALL';

-- Duplicate targets have identical visibility semantics. Keep one stable row.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY post_id, type, class_id
           ORDER BY id
         ) AS duplicate_number
  FROM post_audience
)
DELETE FROM post_audience pa
USING ranked
WHERE pa.id = ranked.id
  AND ranked.duplicate_number > 1;

-- Fail closed when legacy data cannot be repaired without choosing a new audience.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM post p
    WHERE p.is_deleted = false
      AND NOT EXISTS (
        SELECT 1
        FROM post_audience pa
        WHERE pa.post_id = p.id
      )
  ) THEN
    RAISE EXCEPTION 'Active posts without audiences must be repaired before this migration';
  END IF;


  IF EXISTS (
    SELECT 1
    FROM post_audience pa
    JOIN post p ON p.id = pa.post_id
    LEFT JOIN "class" c ON c.id = pa.class_id
    WHERE pa.campus_id <> p.campus_id
       OR (pa.type = 'CLASS' AND c.campus_id <> p.campus_id)
  ) THEN
    RAISE EXCEPTION 'Cross-campus post audiences must be repaired before this migration';
  END IF;
END $$;

ALTER TABLE post_audience
  ADD CONSTRAINT post_audience_shape_check
  CHECK (
    (type = 'ALL' AND class_id IS NULL)
    OR
    (type = 'CLASS' AND class_id IS NOT NULL)
  ) NOT VALID;

ALTER TABLE post_audience
  VALIDATE CONSTRAINT post_audience_shape_check;

CREATE UNIQUE INDEX post_audience_all_unique
  ON post_audience (post_id)
  WHERE type = 'ALL';

CREATE UNIQUE INDEX post_audience_class_unique
  ON post_audience (post_id, class_id)
  WHERE type = 'CLASS';

ALTER TABLE post_audience
  DROP CONSTRAINT post_audience_class_id_fkey;

ALTER TABLE post_audience
  ADD CONSTRAINT post_audience_class_id_fkey
  FOREIGN KEY (class_id)
  REFERENCES "class"(id)
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_post_audience_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  affected_post_id uuid;
  audience_count integer;
  all_count integer;
BEGIN
  affected_post_id := COALESCE(NEW.post_id, OLD.post_id);

  IF NOT EXISTS (
    SELECT 1
    FROM post
    WHERE id = affected_post_id
      AND is_deleted = false
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*), count(*) FILTER (WHERE type = 'ALL')
  INTO audience_count, all_count
  FROM post_audience
  WHERE post_id = affected_post_id;

  IF audience_count = 0 THEN
    RAISE EXCEPTION 'Post % must have at least one audience', affected_post_id
      USING ERRCODE = '23514';
  END IF;

  IF all_count > 0 AND audience_count <> 1 THEN
    RAISE EXCEPTION 'Post % cannot combine ALL and CLASS audiences', affected_post_id
      USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM post_audience pa
    JOIN post p ON p.id = pa.post_id
    LEFT JOIN "class" c ON c.id = pa.class_id
    WHERE pa.post_id = affected_post_id
      AND (
        pa.campus_id <> p.campus_id
        OR (pa.type = 'CLASS' AND c.campus_id <> p.campus_id)
      )
  ) THEN
    RAISE EXCEPTION 'Post % has a cross-campus audience', affected_post_id
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_post_audience_reassignment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.post_id IS DISTINCT FROM OLD.post_id THEN
    RAISE EXCEPTION 'Post audiences cannot be reassigned between posts'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS post_audience_reassignment_trigger ON post_audience;
CREATE TRIGGER post_audience_reassignment_trigger
BEFORE UPDATE OF post_id ON post_audience
FOR EACH ROW
EXECUTE FUNCTION prevent_post_audience_reassignment();

DROP TRIGGER IF EXISTS post_audience_integrity_trigger ON post_audience;
CREATE CONSTRAINT TRIGGER post_audience_integrity_trigger
AFTER INSERT OR UPDATE OR DELETE ON post_audience
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_post_audience_integrity();

CREATE OR REPLACE FUNCTION enforce_post_has_audience()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_deleted = false
     AND NOT EXISTS (
       SELECT 1
       FROM post_audience
       WHERE post_id = NEW.id
     ) THEN
    RAISE EXCEPTION 'Post % must have at least one audience', NEW.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS post_has_audience_trigger ON post;
CREATE CONSTRAINT TRIGGER post_has_audience_trigger
AFTER INSERT OR UPDATE OF is_deleted ON post
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_post_has_audience();

COMMIT;
