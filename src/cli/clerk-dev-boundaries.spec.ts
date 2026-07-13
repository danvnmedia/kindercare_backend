import { execFileSync, spawnSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "../..");

function readProjectFile(path: string): string {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

describe("Clerk development CLI boundaries", () => {
  it("keeps baseline and optional database seeds free of Clerk API imports", () => {
    const databaseOnlySeeds = [
      "prisma/seed.ts",
      "prisma/seeds/seed-students.ts",
      "prisma/seeds/seed-guardians.ts",
      "prisma/seeds/seed-dev-data.ts",
    ];

    for (const path of databaseOnlySeeds) {
      const source = readProjectFile(path);
      expect(source).not.toMatch(
        /@clerk\/backend|createClerkClient|\.users\.createUser/,
      );
    }
  });

  it("preserves provisioned guardian identity links on database-seed reruns", () => {
    const guardianSeed = readProjectFile("prisma/seeds/seed-guardians.ts");

    expect(guardianSeed).toContain("...(userId ? { userId } : {})");
  });

  it("keeps tenant wipe code independent from Prisma and the database", () => {
    const wipeSource = [
      readProjectFile("src/cli/clerk-tenant-wipe.ts"),
      readProjectFile("src/cli/wipe-clerk-users.ts"),
    ].join("\n");

    expect(wipeSource).not.toMatch(/@prisma\/client|PrismaClient|DATABASE_URL/);
  });

  it("wires explicit commands without hardcoding the guardian password", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    const runtimeSources = [
      readProjectFile("src/cli/clerk-dev-tools.ts"),
      readProjectFile("src/cli/provision-guardian-clerk.ts"),
      readProjectFile("src/cli/clerk-tenant-wipe.ts"),
      readProjectFile("src/cli/wipe-clerk-users.ts"),
    ].join("\n");

    expect(packageJson.scripts["seed:provision-guardian-clerk"]).toContain(
      "provision-guardian-clerk.ts",
    );
    expect(packageJson.scripts["clerk:wipe-all-users"]).toContain(
      "wipe-clerk-users.ts",
    );
    expect(runtimeSources).toContain("SEED_CLERK_GUARDIAN_PASSWORD");
    expect(runtimeSources).toContain("password: input.password");
  });

  it("loads a required .env.local while preserving explicit environment values", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["seed:provision-guardian-clerk"]).toBe(
      "node --env-file=.env.local -r ts-node/register -r tsconfig-paths/register ./src/cli/provision-guardian-clerk.ts",
    );
    expect(packageJson.scripts["clerk:wipe-all-users"]).toBe(
      "node --env-file=.env.local -r ts-node/register -r tsconfig-paths/register ./src/cli/wipe-clerk-users.ts",
    );

    const directory = mkdtempSync(resolve(tmpdir(), "clerk-wipe-env-"));
    const envFile = resolve(directory, ".env.local");
    try {
      writeFileSync(envFile, "CLERK_WIPE_ENV_SOURCE=env-file\n", "utf8");
      const output = execFileSync(
        process.execPath,
        [
          `--env-file=${envFile}`,
          "-r",
          "ts-node/register",
          "-r",
          "tsconfig-paths/register",
          "-e",
          "process.stdout.write(process.env.CLERK_WIPE_ENV_SOURCE ?? '')",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, CLERK_WIPE_ENV_SOURCE: "process" },
        },
      );
      expect(output).toBe("process");

      const missingFile = spawnSync(
        process.execPath,
        [
          `--env-file=${resolve(directory, "missing.env")}`,
          "-e",
          "process.exit(0)",
        ],
        { encoding: "utf8" },
      );
      expect(missingFile.status).not.toBe(0);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("documents npm's destructive-argument forwarding syntax", () => {
    const deploymentGuide = readProjectFile(
      ".knowns/docs/guides/backend-dev-deployment.md",
    );

    expect(deploymentGuide).toContain(
      "npm run clerk:wipe-all-users -- -- --execute --confirm DELETE_ALL_CLERK_USERS",
    );
  });
});
