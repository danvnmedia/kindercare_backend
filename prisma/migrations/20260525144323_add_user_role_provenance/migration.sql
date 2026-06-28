-- ============================================================================
-- Migration: add_user_role_provenance
-- ============================================================================
-- Adds `granted_via_staff_type_id` to `user_roles` so the application can
-- distinguish auto-granted role assignments (created when a staff is assigned
-- a StaffType whose `default_role_id` is set) from manual grants.
--
-- Source-of-truth: @doc/specs/tracked-grant-revocation
--   - Schema delta: §"Schema delta"
--   - Fulfills: AC-1 (column + FK + index), AC-2 (existing rows stay NULL)
--
-- Rationale:
--   - Nullable column. NULL = manual grant; non-NULL = grant created by a
--     staff-type default-role assignment.
--   - `ON DELETE SET NULL` on the FK to `staff_type.id`. If a StaffType is
--     hard-deleted, provenance is cleared and the row becomes an "orphaned
--     manual" grant — never auto-revoked. The codebase normally soft-deletes
--     StaffTypes via `archive()`, so hard delete is operationally rare.
--   - Non-unique `@@index([granted_via_staff_type_id])` to support the
--     downstream revoke query `deleteMany({ where: { userId, grantedViaStaffTypeId } })`.
--   - Existing `(user_id, role_id, campus_id)` unique constraint is unchanged.
--     Conflicts between manual rows and tracked-grant inserts are handled in
--     application code (manual-wins, see spec §D5 conflict mechanics).
--
-- Backfill: none. The column defaults to NULL, so every pre-existing row in
-- `user_roles` becomes a "manual grant" — matching the spec's D2 hard-break
-- decision (no historical reconstruction).
--
-- Forward-only; Prisma has no native down-migration. The ROLLBACK block at
-- the bottom of this file is the manual undo.
-- ============================================================================

-- AlterTable
ALTER TABLE "user_roles" ADD COLUMN     "granted_via_staff_type_id" UUID;

-- CreateIndex
CREATE INDEX "user_roles_granted_via_staff_type_id_idx" ON "user_roles"("granted_via_staff_type_id");

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_granted_via_staff_type_id_fkey" FOREIGN KEY ("granted_via_staff_type_id") REFERENCES "staff_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- ROLLBACK (manual; Prisma does not auto-rollback)
-- ============================================================================
-- BEGIN;
--   ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "user_roles_granted_via_staff_type_id_fkey";
--   DROP INDEX IF EXISTS "user_roles_granted_via_staff_type_id_idx";
--   ALTER TABLE "user_roles" DROP COLUMN IF EXISTS "granted_via_staff_type_id";
-- COMMIT;
-- After applying, remove `grantedViaStaffTypeId` / `grantedViaStaffType` from
-- the UserRole model and `userRoleProvenance` from the StaffType model in
-- prisma/schema.prisma, then run `npx prisma generate`.
