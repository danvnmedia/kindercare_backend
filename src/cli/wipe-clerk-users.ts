#!/usr/bin/env node
import { createClerkClient } from "@clerk/backend";
import {
  clerkTenantWipeExitCode,
  formatClerkTenantWipeSummary,
  parseClerkTenantWipeArgs,
  readClerkTenantWipeEnvironment,
  wipeClerkTenantUsers,
} from "./clerk-tenant-wipe";

export async function runClerkTenantWipe(
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  const { secretKey } = readClerkTenantWipeEnvironment(env);
  const options = parseClerkTenantWipeArgs(args);
  const clerkClient = createClerkClient({ secretKey });
  const summary = await wipeClerkTenantUsers({
    options,
    clerk: {
      async listUsers(input) {
        const result = await clerkClient.users.getUserList(input);
        return {
          data: result.data.map(({ id }) => ({ id })),
          totalCount: result.totalCount,
        };
      },
      async deleteUser(userId) {
        await clerkClient.users.deleteUser(userId);
      },
    },
  });

  console.log(formatClerkTenantWipeSummary(summary));
  return clerkTenantWipeExitCode(summary);
}

if (require.main === module) {
  void runClerkTenantWipe()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error: unknown) => {
      console.error(
        error instanceof Error ? error.message : "Clerk tenant wipe failed.",
      );
      process.exitCode = 1;
    });
}
