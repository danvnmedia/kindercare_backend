export const CLERK_DEV_GUARDIAN_MARKER_KEY = "kindercareDevSeed";
export const CLERK_DEV_GUARDIAN_FAMILY = "guardian";
export const CLERK_TENANT_WIPE_CONFIRMATION = "DELETE_ALL_CLERK_USERS";

export interface GuardianSeedFixture {
  seedKey: string;
  fullName: string;
  email: string;
  phoneNumber: string;
}

export interface ClerkSeedUser {
  id: string;
  publicMetadata?: unknown;
}

export interface GuardianClerkGateway {
  findUsersByEmail(email: string): Promise<ClerkSeedUser[]>;
  createUser(input: {
    email: string;
    fullName: string;
    phoneNumber: string;
    password: string;
    publicMetadata: Record<string, unknown>;
  }): Promise<ClerkSeedUser>;
}

export interface GuardianIdentityLinker {
  preflight(
    fixtures: readonly GuardianSeedFixture[],
    campusId: string,
  ): Promise<void>;
  linkIdentity(input: {
    fixture: GuardianSeedFixture;
    campusId: string;
    clerkUid: string;
  }): Promise<void>;
}

export interface GuardianProvisioningSummary {
  total: number;
  processed: number;
  createdClerkUsers: number;
  reusedClerkUsers: number;
  linkedGuardians: number;
  failedSeedKey?: string;
}

export class GuardianProvisioningError extends Error {
  constructor(
    message: string,
    readonly summary: GuardianProvisioningSummary,
  ) {
    super(message);
    this.name = "GuardianProvisioningError";
  }
}

class GuardianSeedConflictError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredEnvironmentValue(
  env: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required and cannot be blank.`);
  }
  return value;
}

export function assertNonProduction(
  env: NodeJS.ProcessEnv,
  operation: string,
): void {
  if (env.NODE_ENV?.trim().toLowerCase() === "production") {
    throw new Error(`${operation} is permanently disabled in production.`);
  }
}

export function readGuardianProvisioningEnvironment(
  env: NodeJS.ProcessEnv = process.env,
): { secretKey: string; password: string } {
  assertNonProduction(env, "Guardian Clerk provisioning");
  return {
    secretKey: requiredEnvironmentValue(env, "CLERK_SECRET_KEY"),
    password: requiredEnvironmentValue(env, "SEED_CLERK_GUARDIAN_PASSWORD"),
  };
}

export function guardianSeedMarker(
  campusId: string,
  seedKey: string,
): Record<string, unknown> {
  return {
    family: CLERK_DEV_GUARDIAN_FAMILY,
    campusId,
    seedKey,
    version: 1,
  };
}

export function hasExpectedGuardianSeedMarker(
  user: ClerkSeedUser,
  campusId: string,
  seedKey: string,
): boolean {
  if (!isRecord(user.publicMetadata)) return false;
  const marker = user.publicMetadata[CLERK_DEV_GUARDIAN_MARKER_KEY];
  if (!isRecord(marker)) return false;

  return (
    marker.family === CLERK_DEV_GUARDIAN_FAMILY &&
    marker.campusId === campusId &&
    marker.seedKey === seedKey &&
    marker.version === 1
  );
}

export function validateGuardianSeedFixtures(
  fixtures: readonly GuardianSeedFixture[],
): GuardianSeedFixture[] {
  if (fixtures.length !== 15) {
    throw new Error(
      `Guardian Clerk provisioning requires exactly 15 fixtures; received ${fixtures.length}.`,
    );
  }

  const seedKeys = new Set<string>();
  const emails = new Set<string>();
  const phoneNumbers = new Set<string>();
  for (const fixture of fixtures) {
    const normalizedEmail = fixture.email.trim().toLowerCase();
    const normalizedPhoneNumber = fixture.phoneNumber.trim();
    if (
      !fixture.seedKey.trim() ||
      !fixture.fullName.trim() ||
      !normalizedEmail ||
      !normalizedPhoneNumber
    ) {
      throw new Error(
        "Guardian Clerk fixtures contain a blank required field.",
      );
    }
    if (seedKeys.has(fixture.seedKey)) {
      throw new Error(`Duplicate guardian seed key ${fixture.seedKey}.`);
    }
    if (emails.has(normalizedEmail)) {
      throw new Error(`Duplicate guardian fixture email ${normalizedEmail}.`);
    }
    if (!/^[^@]+\+clerk_test@example\.com$/.test(normalizedEmail)) {
      throw new Error(
        `Guardian fixture ${fixture.seedKey} must use a Clerk test email.`,
      );
    }
    if (!/^\+155555501\d{2}$/.test(normalizedPhoneNumber)) {
      throw new Error(
        `Guardian fixture ${fixture.seedKey} must use a Clerk test phone number.`,
      );
    }
    if (phoneNumbers.has(normalizedPhoneNumber)) {
      throw new Error(
        `Duplicate guardian fixture phone number ${normalizedPhoneNumber}.`,
      );
    }
    seedKeys.add(fixture.seedKey);
    emails.add(normalizedEmail);
    phoneNumbers.add(normalizedPhoneNumber);
  }

  return [...fixtures].sort((left, right) =>
    left.seedKey.localeCompare(right.seedKey),
  );
}

function safeProvisioningFailure(error: unknown): string {
  if (error instanceof GuardianSeedConflictError) return error.message;
  return "Clerk provisioning or guardian identity linking failed.";
}

export async function provisionGuardianClerkAccounts(input: {
  fixtures: readonly GuardianSeedFixture[];
  campusId: string;
  password: string;
  clerk: GuardianClerkGateway;
  identityLinker?: GuardianIdentityLinker;
}): Promise<GuardianProvisioningSummary> {
  const fixtures = validateGuardianSeedFixtures(input.fixtures);
  await input.identityLinker?.preflight(fixtures, input.campusId);

  const summary: GuardianProvisioningSummary = {
    total: fixtures.length,
    processed: 0,
    createdClerkUsers: 0,
    reusedClerkUsers: 0,
    linkedGuardians: 0,
  };

  for (const fixture of fixtures) {
    try {
      const matches = await input.clerk.findUsersByEmail(fixture.email);
      if (matches.length > 1) {
        throw new GuardianSeedConflictError(
          `Multiple Clerk users match fixture ${fixture.seedKey}; no account was attached.`,
        );
      }

      let clerkUser = matches[0];
      if (clerkUser) {
        if (
          !hasExpectedGuardianSeedMarker(
            clerkUser,
            input.campusId,
            fixture.seedKey,
          )
        ) {
          throw new GuardianSeedConflictError(
            `Clerk email conflict for fixture ${fixture.seedKey}; the existing user is not marked for this fixture.`,
          );
        }
        summary.reusedClerkUsers += 1;
      } else {
        const marker = guardianSeedMarker(input.campusId, fixture.seedKey);
        clerkUser = await input.clerk.createUser({
          email: fixture.email,
          fullName: fixture.fullName,
          phoneNumber: fixture.phoneNumber,
          password: input.password,
          publicMetadata: {
            fullName: fixture.fullName.trim(),
            [CLERK_DEV_GUARDIAN_MARKER_KEY]: marker,
          },
        });
        summary.createdClerkUsers += 1;
      }

      if (input.identityLinker) {
        await input.identityLinker.linkIdentity({
          fixture,
          campusId: input.campusId,
          clerkUid: clerkUser.id,
        });
        summary.linkedGuardians += 1;
      }
      summary.processed += 1;
    } catch (error) {
      summary.failedSeedKey = fixture.seedKey;
      throw new GuardianProvisioningError(
        `${safeProvisioningFailure(error)} Failed fixture: ${fixture.seedKey}. Completed ${summary.processed} of ${summary.total}; rerun after correcting the cause.`,
        summary,
      );
    }
  }

  return summary;
}

export function formatGuardianProvisioningSummary(
  summary: GuardianProvisioningSummary,
): string {
  const failed = summary.failedSeedKey
    ? `, failed fixture ${summary.failedSeedKey}`
    : "";
  return `Guardian Clerk provisioning: ${summary.processed}/${summary.total} processed, ${summary.createdClerkUsers} created, ${summary.reusedClerkUsers} reused, ${summary.linkedGuardians} linked${failed}.`;
}
