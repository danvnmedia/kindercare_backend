-- Retire permission IDs that have no active HTTP contract. Remove joins first
-- so the cleanup remains valid even if foreign-key cascade behavior changes.
BEGIN;

DELETE FROM "role_permission"
WHERE "permission_id" IN (
  'medication_request.create',
  'medication_request.delete',
  'medication_administration.list'
);

DELETE FROM "permission"
WHERE "id" IN (
  'medication_request.create',
  'medication_request.delete',
  'medication_administration.list'
);

-- student_health.delete is intentionally seed-owned. Deployments must run the
-- permission seed after migrations so the catalog and Super Admin grant align.
COMMIT;
