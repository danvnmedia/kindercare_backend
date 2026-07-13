-- ============================================================================
-- Migration: staff_campus_access_role_backfill
-- ============================================================================
-- Creates a backend-managed, permissionless campus role used only to make
-- staff users campus-discoverable when StaffType.default_role_id was never
-- configured by the frontend. Feature access remains permission-gated.

-- Fail closed when the reserved role name belongs to a different role. Reusing
-- such a row could grant staff its permissions or make a user-managed role
-- unexpectedly immutable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "role" r
    WHERE r."name" = 'Staff Campus Access'
      AND (
        r."description" IS DISTINCT FROM 'Backend-managed minimal role that grants staff campus discovery when no StaffType default role is configured. It carries no permissions; feature access remains permission-gated.'
        OR r."is_system_role" = true
        OR EXISTS (
          SELECT 1
          FROM "role_permission" rp
          WHERE rp."role_id" = r."id"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Reserved role name "Staff Campus Access" is already used by an unmanaged or permission-bearing role';
  END IF;
END $$;

-- Runtime-created fallback roles from pre-migration deployments are promoted
-- to protected system defaults only after the ownership checks above pass.
UPDATE "role"
SET
  "is_system_default" = true,
  "updated_at" = NOW()
WHERE "name" = 'Staff Campus Access'
  AND "description" = 'Backend-managed minimal role that grants staff campus discovery when no StaffType default role is configured. It carries no permissions; feature access remains permission-gated.'
  AND "is_system_role" = false;

INSERT INTO "role" (
  "id",
  "campus_id",
  "name",
  "description",
  "is_system_default",
  "is_system_role",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  c."id",
  'Staff Campus Access',
  'Backend-managed minimal role that grants staff campus discovery when no StaffType default role is configured. It carries no permissions; feature access remains permission-gated.',
  true,
  false,
  NOW(),
  NOW()
FROM "campus" c
WHERE NOT EXISTS (
  SELECT 1
  FROM "role" r
  WHERE r."campus_id" = c."id"
    AND r."name" = 'Staff Campus Access'
);

UPDATE "staff_type" st
SET
  "default_role_id" = r."id",
  "updated_at" = NOW()
FROM "role" r
WHERE st."default_role_id" IS NULL
  AND st."is_archived" = false
  AND r."campus_id" = st."campus_id"
  AND r."name" = 'Staff Campus Access';

INSERT INTO "user_roles" (
  "id",
  "user_id",
  "role_id",
  "campus_id",
  "granted_via_staff_type_id",
  "assigned_at"
)
SELECT
  gen_random_uuid(),
  s."user_id",
  st."default_role_id",
  s."campus_id",
  sst."staff_type_id",
  NOW()
FROM "staff" s
JOIN "staff_staff_type" sst ON sst."staff_id" = s."id"
JOIN "staff_type" st ON st."id" = sst."staff_type_id"
WHERE s."user_id" IS NOT NULL
  AND s."is_archived" = false
  AND st."is_archived" = false
  AND st."campus_id" = s."campus_id"
  AND st."default_role_id" IS NOT NULL
ON CONFLICT DO NOTHING;
