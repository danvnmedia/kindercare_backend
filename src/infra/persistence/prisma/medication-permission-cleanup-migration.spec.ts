import { readFileSync } from "fs";
import { resolve } from "path";

describe("medication permission cleanup migration", () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      "prisma/migrations/20260714173000_remove_obsolete_medication_permissions/migration.sql",
    ),
    "utf8",
  );
  const obsoletePermissionIds = [
    "medication_request.create",
    "medication_request.delete",
    "medication_administration.list",
  ];

  it("deletes role assignments before obsolete permission rows", () => {
    const rolePermissionDelete = sql.indexOf('DELETE FROM "role_permission"');
    const permissionDelete = sql.indexOf('DELETE FROM "permission"');

    expect(rolePermissionDelete).toBeGreaterThan(-1);
    expect(permissionDelete).toBeGreaterThan(rolePermissionDelete);
  });

  it.each(obsoletePermissionIds)("targets obsolete permission %s", (id) => {
    expect(
      sql.match(new RegExp(`'${id.replace(".", "\\.")}'`, "g")),
    ).toHaveLength(2);
  });

  it("does not delete active permissions or insert the new health permission", () => {
    expect(sql).not.toMatch(/DELETE[\s\S]*medication_request\.read/);
    expect(sql).not.toMatch(/DELETE[\s\S]*medication_request\.list/);
    expect(sql).not.toMatch(/DELETE[\s\S]*medication_request\.update/);
    expect(sql).not.toMatch(/DELETE[\s\S]*medication_administration\.read/);
    expect(sql).not.toMatch(/DELETE[\s\S]*medication_administration\.create/);
    expect(sql).not.toMatch(/DELETE[\s\S]*medication_administration\.update/);
    expect(sql).not.toMatch(/INSERT\s+INTO/i);
  });
});
