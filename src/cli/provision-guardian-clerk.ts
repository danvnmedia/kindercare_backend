#!/usr/bin/env node
import { createClerkClient } from "@clerk/backend";
import { PrismaClient } from "@prisma/client";
import {
  GUARDIAN_FIXTURES,
  type GuardianFixture,
} from "../../prisma/seeds/seed-guardians";
import { getSeedCampusId } from "../../prisma/seeds/seed-support";
import {
  formatGuardianProvisioningSummary,
  GuardianProvisioningError,
  provisionGuardianClerkAccounts,
  readGuardianProvisioningEnvironment,
} from "./clerk-dev-tools";
import {
  createPrismaGuardianIdentityDatabase,
  PrismaGuardianIdentityLinker,
} from "./prisma-guardian-identity-linker";

function toProvisioningFixtures(fixtures: readonly GuardianFixture[]) {
  return fixtures.map(({ seedKey, fullName, email, phoneNumber }) => ({
    seedKey,
    fullName,
    email,
    phoneNumber,
  }));
}

export async function runGuardianClerkProvisioning(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const { secretKey, password } = readGuardianProvisioningEnvironment(env);
  const clerkClient = createClerkClient({ secretKey });
  const prisma = new PrismaClient();

  try {
    const summary = await provisionGuardianClerkAccounts({
      fixtures: toProvisioningFixtures(GUARDIAN_FIXTURES),
      campusId: getSeedCampusId(),
      password,
      clerk: {
        async findUsersByEmail(email) {
          const result = await clerkClient.users.getUserList({
            emailAddress: [email],
          });
          return result.data.map((user) => ({
            id: user.id,
            publicMetadata: user.publicMetadata,
          }));
        },
        async createUser(input) {
          const user = await clerkClient.users.createUser({
            emailAddress: [input.email],
            phoneNumber: [input.phoneNumber],
            password: input.password,
            skipPasswordChecks: true,
            publicMetadata: input.publicMetadata,
          });
          return { id: user.id, publicMetadata: user.publicMetadata };
        },
      },
      identityLinker: new PrismaGuardianIdentityLinker(
        createPrismaGuardianIdentityDatabase(prisma),
      ),
    });

    console.log(formatGuardianProvisioningSummary(summary));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void runGuardianClerkProvisioning().catch((error: unknown) => {
    if (error instanceof GuardianProvisioningError) {
      console.error(error.message);
      console.error(formatGuardianProvisioningSummary(error.summary));
    } else {
      console.error(
        error instanceof Error ? error.message : "Provisioning failed.",
      );
    }
    process.exitCode = 1;
  });
}
