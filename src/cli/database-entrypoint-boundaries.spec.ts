import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "../..");

interface PackageJson {
  scripts: Record<string, string>;
  prisma: { seed: string };
}

interface Launcher {
  name: string;
  command: string;
}

function readProjectFile(path: string): string {
  return readFileSync(resolve(projectRoot, path), "utf8");
}

function typeScriptTarget(command: string): string | undefined {
  return command
    .split(/\s+/)
    .find((part) => part.endsWith(".ts"))
    ?.replace(/^\.\//, "");
}

function loadsRepositoryEnvironment(command: string): boolean {
  return (
    command.includes("-r dotenv/config") || command.includes("--env-file=.env")
  );
}

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(resolve(projectRoot, directory), {
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) => `${directory}/${entry.name}`);
}

function isExecutablePrismaSource(source: string): boolean {
  return (
    source.includes("new PrismaClient(") &&
    (source.startsWith("#!") ||
      source.includes("if (require.main === module)") ||
      /\n(?:void )?main\(\)\s*\n?\s*\.catch\(/.test(source))
  );
}

describe("database entrypoint environment boundaries", () => {
  const packageJson = JSON.parse(
    readProjectFile("package.json"),
  ) as PackageJson;

  it("loads .env for every executable Prisma TypeScript entrypoint", () => {
    const launchersByTarget = new Map<string, Launcher[]>();

    for (const [name, command] of Object.entries(packageJson.scripts)) {
      const target = typeScriptTarget(command);
      if (!target) continue;

      launchersByTarget.set(target, [
        ...(launchersByTarget.get(target) ?? []),
        { name, command },
      ]);
    }

    const candidates = [
      "prisma/seed.ts",
      ...listTypeScriptFiles("prisma/seeds"),
      ...listTypeScriptFiles("src/cli"),
    ];
    const executablePrismaSources = candidates.filter((path) =>
      isExecutablePrismaSource(readProjectFile(path)),
    );

    expect(executablePrismaSources).toContain("prisma/seed.ts");

    for (const path of executablePrismaSources) {
      if (path === "prisma/seed.ts") {
        expect(packageJson.scripts["prisma:seed"]).toContain("prisma db seed");
        expect(packageJson.prisma.seed).toContain(path);
        continue;
      }

      const source = readProjectFile(path);
      const launchers = launchersByTarget.get(path) ?? [];
      const hasSourcePreload = source.includes('import "dotenv/config";');
      const launchersLoadEnvironment =
        launchers.length > 0 &&
        launchers.every(({ command }) => loadsRepositoryEnvironment(command));
      const hasEnvironmentLoader = hasSourcePreload || launchersLoadEnvironment;
      const launcherNames = launchers.map(({ name }) => name);

      expect({
        path,
        launcherNames,
        hasEnvironmentLoader,
      }).toEqual({
        path,
        launcherNames,
        hasEnvironmentLoader: true,
      });
    }
  });

  it("loads .env without replacing an injected DATABASE_URL", () => {
    const directory = mkdtempSync(
      resolve(tmpdir(), "database-entrypoint-env-"),
    );
    const dotenvConfig = require.resolve("dotenv/config");
    const expression =
      "process.stdout.write(process.env.DATABASE_URL ?? 'missing')";

    try {
      writeFileSync(
        resolve(directory, ".env"),
        "DATABASE_URL=postgresql://file-value.invalid/example\n",
        "utf8",
      );

      const baseEnvironment = { ...process.env };
      delete baseEnvironment.DATABASE_URL;

      const fileValue = execFileSync(
        process.execPath,
        ["-r", dotenvConfig, "-e", expression],
        {
          cwd: directory,
          encoding: "utf8",
          env: { ...baseEnvironment, DOTENV_CONFIG_QUIET: "true" },
        },
      );
      expect(fileValue).toBe("postgresql://file-value.invalid/example");

      const injectedValue = execFileSync(
        process.execPath,
        ["-r", dotenvConfig, "-e", expression],
        {
          cwd: directory,
          encoding: "utf8",
          env: {
            ...baseEnvironment,
            DOTENV_CONFIG_QUIET: "true",
            DATABASE_URL: "postgresql://injected.invalid/example",
          },
        },
      );
      expect(injectedValue).toBe("postgresql://injected.invalid/example");

      rmSync(resolve(directory, ".env"));
      const withoutFile = execFileSync(
        process.execPath,
        ["-r", dotenvConfig, "-e", expression],
        {
          cwd: directory,
          encoding: "utf8",
          env: {
            ...baseEnvironment,
            DOTENV_CONFIG_QUIET: "true",
            DATABASE_URL: "postgresql://container.invalid/example",
          },
        },
      );
      expect(withoutFile).toBe("postgresql://container.invalid/example");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("keeps split PostgreSQL credentials inside the optional local service", () => {
    const applicationConfiguration = [
      "docker-compose.yml",
      "docker-compose.dev.yml",
      "docker-compose.prod.yml",
      ".env.example",
    ]
      .map((path) => `${path}\n${readProjectFile(path)}`)
      .join("\n");

    expect(applicationConfiguration).not.toMatch(
      /POSTGRES_(?:USER|PASSWORD|DB)/,
    );

    const localFallback = readProjectFile("docker-compose.db.yml");
    expect(localFallback).toContain("POSTGRES_USER");
    expect(localFallback).toContain("POSTGRES_PASSWORD");
    expect(localFallback).toContain("POSTGRES_DB");
  });
});
