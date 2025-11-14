-- Drop FK constraints that depend on Role.id before changing the column type
ALTER TABLE "_RoleToUser" DROP CONSTRAINT IF EXISTS "_RoleToUser_A_fkey";

-- Drop primary key and default so we can alter the Role.id type
ALTER TABLE "Role" DROP CONSTRAINT IF EXISTS "Role_pkey";
ALTER TABLE "Role" ALTER COLUMN "id" DROP DEFAULT;

-- Convert Role.id from SERIAL/INTEGER to TEXT
ALTER TABLE "Role" ALTER COLUMN "id" TYPE TEXT USING "id"::text;
ALTER TABLE "Role" ALTER COLUMN "id" SET NOT NULL;

-- Drop the old sequence that backed the SERIAL column
DROP SEQUENCE IF EXISTS "Role_id_seq";

-- Recreate the primary key on the new text column
ALTER TABLE "Role" ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");

-- Update the join table column to match the new type
ALTER TABLE "_RoleToUser" ALTER COLUMN "A" TYPE TEXT USING "A"::text;

-- Recreate the FK from the join table back to Role
ALTER TABLE "_RoleToUser"
  ADD CONSTRAINT "_RoleToUser_A_fkey"
  FOREIGN KEY ("A") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Normalize the existing role identifiers/names to the new convention
UPDATE "Role"
SET
  id = CASE
    WHEN lower(name) IN ('school_admin', 'admin') THEN 'admin'
    WHEN lower(name) = 'teacher' THEN 'teacher'
    WHEN lower(name) IN ('parent', 'student') THEN 'student'
    ELSE regexp_replace(lower(name), '[^a-z0-9]+', '_', 'g')
  END,
  name = CASE
    WHEN lower(name) IN ('school_admin', 'admin') THEN 'ADMIN'
    WHEN lower(name) = 'teacher' THEN 'TEACHER'
    WHEN lower(name) IN ('parent', 'student') THEN 'STUDENT'
    ELSE upper(name)
  END;
