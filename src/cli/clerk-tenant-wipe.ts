import {
  assertNonProduction,
  CLERK_TENANT_WIPE_CONFIRMATION,
} from "./clerk-dev-tools";

export interface ClerkTenantAdminGateway {
  listUsers(input: {
    limit: number;
    offset: number;
  }): Promise<{ data: Array<{ id: string }>; totalCount: number }>;
  deleteUser(userId: string): Promise<void>;
}

export interface ClerkTenantWipeOptions {
  execute: boolean;
  confirmation?: string;
}

export interface ClerkTenantWipeSummary {
  mode: "preview" | "execute";
  discovered: number;
  deleted: number;
  failed: number;
  failedUserIds: string[];
}

function requiredSecretKey(env: NodeJS.ProcessEnv): string {
  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey?.trim()) {
    throw new Error("CLERK_SECRET_KEY is required and cannot be blank.");
  }
  return secretKey;
}

export function readClerkTenantWipeEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): { secretKey: string } {
  assertNonProduction(env, "Clerk tenant wipe");
  return { secretKey: requiredSecretKey(env) };
}

export function parseClerkTenantWipeArgs(
  args: readonly string[],
): ClerkTenantWipeOptions {
  let execute = false;
  let confirmation: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--execute") {
      if (execute) throw new Error("--execute may only be supplied once.");
      execute = true;
      continue;
    }
    if (argument === "--confirm") {
      if (confirmation !== undefined) {
        throw new Error("--confirm may only be supplied once.");
      }
      confirmation = args[index + 1];
      if (confirmation === undefined) {
        throw new Error("--confirm requires a value.");
      }
      index += 1;
      continue;
    }
    if (argument.startsWith("--confirm=")) {
      if (confirmation !== undefined) {
        throw new Error("--confirm may only be supplied once.");
      }
      confirmation = argument.slice("--confirm=".length);
      continue;
    }
    throw new Error(`Unknown Clerk tenant wipe argument: ${argument}`);
  }

  return { execute, confirmation };
}

function assertExecutionConfirmed(options: ClerkTenantWipeOptions): void {
  if (
    options.execute &&
    options.confirmation !== CLERK_TENANT_WIPE_CONFIRMATION
  ) {
    throw new Error(
      `Clerk tenant deletion requires --execute --confirm ${CLERK_TENANT_WIPE_CONFIRMATION}.`,
    );
  }
}

export async function listAllClerkUserIds(
  clerk: ClerkTenantAdminGateway,
  pageSize = 100,
): Promise<string[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error("Clerk tenant wipe page size must be a positive integer.");
  }

  const userIds: string[] = [];
  const seen = new Set<string>();
  let offset = 0;

  while (true) {
    const page = await clerk.listUsers({ limit: pageSize, offset });
    if (!Number.isInteger(page.totalCount) || page.totalCount < 0) {
      throw new Error("Clerk returned an invalid tenant user count.");
    }
    if (page.data.length === 0) {
      if (offset < page.totalCount) {
        throw new Error(
          `Clerk pagination stopped at ${offset} of ${page.totalCount} users. No users were deleted.`,
        );
      }
      break;
    }

    for (const user of page.data) {
      if (!user.id?.trim()) {
        throw new Error("Clerk returned a user without an ID.");
      }
      if (seen.has(user.id)) {
        throw new Error(
          `Clerk pagination returned duplicate user ID ${user.id}. No users were deleted.`,
        );
      }
      seen.add(user.id);
      userIds.push(user.id);
    }

    offset += page.data.length;
    if (offset >= page.totalCount) break;
  }

  return userIds;
}

export async function wipeClerkTenantUsers(input: {
  clerk: ClerkTenantAdminGateway;
  options: ClerkTenantWipeOptions;
  pageSize?: number;
}): Promise<ClerkTenantWipeSummary> {
  assertExecutionConfirmed(input.options);
  const userIds = await listAllClerkUserIds(input.clerk, input.pageSize);
  const summary: ClerkTenantWipeSummary = {
    mode: input.options.execute ? "execute" : "preview",
    discovered: userIds.length,
    deleted: 0,
    failed: 0,
    failedUserIds: [],
  };

  if (!input.options.execute) return summary;

  for (const userId of userIds) {
    try {
      await input.clerk.deleteUser(userId);
      summary.deleted += 1;
    } catch {
      summary.failed += 1;
      summary.failedUserIds.push(userId);
    }
  }

  return summary;
}

export function formatClerkTenantWipeSummary(
  summary: ClerkTenantWipeSummary,
): string {
  const failedIds =
    summary.failedUserIds.length > 0
      ? ` Failed Clerk user IDs: ${summary.failedUserIds.join(", ")}.`
      : "";
  return `Clerk tenant wipe (${summary.mode}): ${summary.discovered} discovered, ${summary.deleted} deleted, ${summary.failed} failed.${failedIds}`;
}

export function clerkTenantWipeExitCode(
  summary: ClerkTenantWipeSummary,
): 0 | 1 {
  return summary.failed > 0 ? 1 : 0;
}
