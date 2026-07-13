import { readFileSync, readdirSync } from "fs";
import { join, resolve } from "path";

function runtimeTypescriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return runtimeTypescriptFiles(path);
    }
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts")
      ? [path]
      : [];
  });
}

describe("school-year lifecycle attendance isolation", () => {
  it("keeps preview, commit, retry, refresh, cancel, expiry, and reconciliation outside attendance boundaries", () => {
    const root = resolve(
      process.cwd(),
      "src/application/class-management/use-cases/school-year-lifecycle",
    );
    const runtimeFiles = [
      ...runtimeTypescriptFiles(root),
      resolve(
        process.cwd(),
        "src/infra/persistence/prisma/repositories/prisma-school-year-lifecycle.repository.ts",
      ),
      resolve(
        process.cwd(),
        "src/infra/http/controllers/class-management/school-year-lifecycle.controller.ts",
      ),
      resolve(
        process.cwd(),
        "src/application/class-management/use-cases/school-year-enrollment/cancel-school-year-enrollment.use-case.ts",
      ),
      resolve(
        process.cwd(),
        "src/infra/persistence/prisma/repositories/prisma-enrollment-cancellation.repository.ts",
      ),
    ];

    for (const file of runtimeFiles) {
      expect({ file, source: readFileSync(file, "utf8") }).toEqual({
        file,
        source: expect.not.stringMatching(/attendance/i),
      });
    }
  });

  it("keeps the lifecycle migration free of attendance table reads or writes", () => {
    const migrations = [
      "prisma/migrations/20260710160000_add_school_year_lifecycle_run_workflow/migration.sql",
      "prisma/migrations/20260711153000_add_enrollment_cancellation_status/migration.sql",
      "prisma/migrations/20260711173000_enforce_upcoming_cancellation_at_commit/migration.sql",
    ];
    for (const path of migrations) {
      expect(readFileSync(resolve(process.cwd(), path), "utf8")).not.toMatch(
        /attendance/i,
      );
    }
  });
});
