import {
  CLERK_DEV_GUARDIAN_MARKER_KEY,
  GuardianClerkGateway,
  GuardianProvisioningError,
  GuardianSeedFixture,
  guardianSeedMarker,
  provisionGuardianClerkAccounts,
  readGuardianProvisioningEnvironment,
} from "./clerk-dev-tools";
import { fixtureId } from "../../prisma/seeds/seed-support";
import {
  GuardianIdentityDatabase,
  GuardianIdentityRecord,
  GuardianIdentityTransaction,
  InternalIdentityRecord,
  PrismaGuardianIdentityLinker,
} from "./prisma-guardian-identity-linker";

function fixtures(): GuardianSeedFixture[] {
  return Array.from({ length: 15 }, (_, index) => {
    const number = String(index + 1).padStart(3, "0");
    return {
      seedKey: `guardian-${number}`,
      fullName: `Guardian ${number}`,
      email: `guardian-${number}+clerk_test@example.com`,
      phoneNumber: `+155555501${String(index).padStart(2, "0")}`,
    };
  });
}

function createFakeClerk() {
  const users = new Map<
    string,
    { id: string; publicMetadata: Record<string, unknown> }
  >();
  let nextUserId = 1;
  const createUser = jest.fn<
    ReturnType<GuardianClerkGateway["createUser"]>,
    Parameters<GuardianClerkGateway["createUser"]>
  >(async (input) => {
    const user = {
      id: `user_${nextUserId++}`,
      publicMetadata: input.publicMetadata,
    };
    users.set(input.email.toLowerCase(), user);
    return user;
  });
  const findUsersByEmail = jest.fn<
    ReturnType<GuardianClerkGateway["findUsersByEmail"]>,
    Parameters<GuardianClerkGateway["findUsersByEmail"]>
  >(async (email) => {
    const user = users.get(email.toLowerCase());
    return user ? [user] : [];
  });

  return { users, gateway: { createUser, findUsersByEmail } };
}

function createFakeIdentityDatabase(seedFixtures = fixtures()) {
  const campusId = "campus-1";
  const guardians = new Map<string, GuardianIdentityRecord>();
  const users = new Map<string, InternalIdentityRecord>();
  for (const fixture of seedFixtures) {
    const id = fixtureId(campusId, "guardian", fixture.seedKey);
    guardians.set(id, {
      id,
      campusId,
      email: fixture.email,
      userId: null,
    });
  }

  const transaction: GuardianIdentityTransaction = {
    async findGuardianById(id) {
      return guardians.get(id) ?? null;
    },
    async findUserById(id) {
      return users.get(id) ?? null;
    },
    async findUserByClerkUid(clerkUid) {
      return (
        [...users.values()].find((user) => user.clerkUid === clerkUid) ?? null
      );
    },
    async createUser(input) {
      users.set(input.id, { ...input });
      return users.get(input.id)!;
    },
    async updateUser(id, input) {
      const current = users.get(id);
      if (!current) throw new Error(`Missing user ${id}`);
      const updated = { ...current, ...input };
      users.set(id, updated);
      return updated;
    },
    async updateGuardianUser(guardianId, userId) {
      const guardian = guardians.get(guardianId);
      if (!guardian) throw new Error(`Missing guardian ${guardianId}`);
      guardians.set(guardianId, { ...guardian, userId });
    },
  };
  const database: GuardianIdentityDatabase = {
    async campusExists(id) {
      return id === campusId;
    },
    findGuardianById: transaction.findGuardianById,
    async transaction(work) {
      return work(transaction);
    },
  };

  return { campusId, database, guardians, users };
}

describe("Clerk development guardian provisioning", () => {
  it("rejects production and blank secrets before provisioning", () => {
    expect(() =>
      readGuardianProvisioningEnvironment({
        NODE_ENV: "production",
        CLERK_SECRET_KEY: "secret",
        SEED_CLERK_GUARDIAN_PASSWORD: "password",
      }),
    ).toThrow("permanently disabled");
    expect(() =>
      readGuardianProvisioningEnvironment({
        NODE_ENV: "development",
        CLERK_SECRET_KEY: " ",
        SEED_CLERK_GUARDIAN_PASSWORD: "password",
      }),
    ).toThrow("CLERK_SECRET_KEY");
    expect(() =>
      readGuardianProvisioningEnvironment({
        NODE_ENV: "development",
        CLERK_SECRET_KEY: "secret",
        SEED_CLERK_GUARDIAN_PASSWORD: " ",
      }),
    ).toThrow("SEED_CLERK_GUARDIAN_PASSWORD");
  });

  it("creates all 15 fixtures deterministically and reuses marked users", async () => {
    const fake = createFakeClerk();
    const inputFixtures = fixtures().reverse();

    const first = await provisionGuardianClerkAccounts({
      fixtures: inputFixtures,
      campusId: "campus-1",
      password: "not-logged",
      clerk: fake.gateway,
    });
    const second = await provisionGuardianClerkAccounts({
      fixtures: inputFixtures,
      campusId: "campus-1",
      password: "not-logged",
      clerk: fake.gateway,
    });

    expect(first).toMatchObject({
      total: 15,
      processed: 15,
      createdClerkUsers: 15,
      reusedClerkUsers: 0,
    });
    expect(second).toMatchObject({
      total: 15,
      processed: 15,
      createdClerkUsers: 0,
      reusedClerkUsers: 15,
    });
    expect(fake.gateway.createUser).toHaveBeenCalledTimes(15);
    expect(fake.gateway.findUsersByEmail.mock.calls[0][0]).toBe(
      "guardian-001+clerk_test@example.com",
    );
    expect(fake.gateway.createUser.mock.calls[0][0]).toMatchObject({
      email: "guardian-001+clerk_test@example.com",
      phoneNumber: "+15555550100",
    });
  });

  it("rejects invalid Clerk test identifiers before making Clerk calls", async () => {
    const fake = createFakeClerk();
    const invalidEmail = fixtures();
    invalidEmail[0] = { ...invalidEmail[0], email: "guardian@example.com" };

    await expect(
      provisionGuardianClerkAccounts({
        fixtures: invalidEmail,
        campusId: "campus-1",
        password: "not-logged",
        clerk: fake.gateway,
      }),
    ).rejects.toThrow("must use a Clerk test email");

    const invalidPhone = fixtures();
    invalidPhone[0] = { ...invalidPhone[0], phoneNumber: "+84900000000" };
    await expect(
      provisionGuardianClerkAccounts({
        fixtures: invalidPhone,
        campusId: "campus-1",
        password: "not-logged",
        clerk: fake.gateway,
      }),
    ).rejects.toThrow("must use a Clerk test phone number");
    expect(fake.gateway.findUsersByEmail).not.toHaveBeenCalled();
    expect(fake.gateway.createUser).not.toHaveBeenCalled();
  });

  it("stops safely on an unmarked email conflict", async () => {
    const fake = createFakeClerk();
    fake.users.set("guardian-002+clerk_test@example.com", {
      id: "unmarked_user",
      publicMetadata: {},
    });

    await expect(
      provisionGuardianClerkAccounts({
        fixtures: fixtures(),
        campusId: "campus-1",
        password: "not-logged",
        clerk: fake.gateway,
      }),
    ).rejects.toMatchObject<Partial<GuardianProvisioningError>>({
      summary: expect.objectContaining({
        processed: 1,
        failedSeedKey: "guardian-002",
      }),
    });
    expect(fake.gateway.createUser).toHaveBeenCalledTimes(1);
  });

  it("requires the marker to match family, campus, key, and version", async () => {
    const fake = createFakeClerk();
    fake.users.set("guardian-001+clerk_test@example.com", {
      id: "wrong_campus",
      publicMetadata: {
        [CLERK_DEV_GUARDIAN_MARKER_KEY]: guardianSeedMarker(
          "campus-2",
          "guardian-001",
        ),
      },
    });

    await expect(
      provisionGuardianClerkAccounts({
        fixtures: fixtures(),
        campusId: "campus-1",
        password: "not-logged",
        clerk: fake.gateway,
      }),
    ).rejects.toThrow("not marked for this fixture");
    expect(fake.gateway.createUser).not.toHaveBeenCalled();
  });

  it("links 15 internal users idempotently and repairs stale Clerk UIDs", async () => {
    const seedFixtures = fixtures();
    const fakeClerk = createFakeClerk();
    const fakeDatabase = createFakeIdentityDatabase(seedFixtures);
    const identityLinker = new PrismaGuardianIdentityLinker(
      fakeDatabase.database,
    );
    const guardianIds = [...fakeDatabase.guardians.keys()];

    const first = await provisionGuardianClerkAccounts({
      fixtures: seedFixtures,
      campusId: fakeDatabase.campusId,
      password: "not-logged",
      clerk: fakeClerk.gateway,
      identityLinker,
    });
    const second = await provisionGuardianClerkAccounts({
      fixtures: seedFixtures,
      campusId: fakeDatabase.campusId,
      password: "not-logged",
      clerk: fakeClerk.gateway,
      identityLinker,
    });
    const staleClerkUids = new Set(
      [...fakeDatabase.users.values()].map((user) => user.clerkUid),
    );

    fakeClerk.users.clear();
    const repaired = await provisionGuardianClerkAccounts({
      fixtures: seedFixtures,
      campusId: fakeDatabase.campusId,
      password: "not-logged",
      clerk: fakeClerk.gateway,
      identityLinker,
    });

    expect(first.linkedGuardians).toBe(15);
    expect(second).toMatchObject({
      linkedGuardians: 15,
      createdClerkUsers: 0,
      reusedClerkUsers: 15,
    });
    expect(repaired).toMatchObject({
      linkedGuardians: 15,
      createdClerkUsers: 15,
    });
    expect(fakeDatabase.users.size).toBe(15);
    expect([...fakeDatabase.guardians.keys()]).toEqual(guardianIds);
    expect(
      [...fakeDatabase.users.values()].every(
        (user) => !staleClerkUids.has(user.clerkUid),
      ),
    ).toBe(true);
    expect(
      [...fakeDatabase.guardians.values()].every(({ userId }) =>
        fakeDatabase.users.has(userId ?? ""),
      ),
    ).toBe(true);
  });

  it("preserves partial successes and resumes after the failure is fixed", async () => {
    const seedFixtures = fixtures();
    const fakeClerk = createFakeClerk();
    const fakeDatabase = createFakeIdentityDatabase(seedFixtures);
    const identityLinker = new PrismaGuardianIdentityLinker(
      fakeDatabase.database,
    );
    const createUser = fakeClerk.gateway.createUser;
    let failEighth = true;
    fakeClerk.gateway.createUser = jest.fn(async (input) => {
      if (failEighth && input.email === "guardian-008+clerk_test@example.com") {
        throw new Error("simulated Clerk failure");
      }
      return createUser(input);
    });

    await expect(
      provisionGuardianClerkAccounts({
        fixtures: seedFixtures,
        campusId: fakeDatabase.campusId,
        password: "not-logged",
        clerk: fakeClerk.gateway,
        identityLinker,
      }),
    ).rejects.toMatchObject<Partial<GuardianProvisioningError>>({
      summary: expect.objectContaining({
        processed: 7,
        failedSeedKey: "guardian-008",
      }),
    });
    expect(fakeDatabase.users.size).toBe(7);

    failEighth = false;
    const resumed = await provisionGuardianClerkAccounts({
      fixtures: seedFixtures,
      campusId: fakeDatabase.campusId,
      password: "not-logged",
      clerk: fakeClerk.gateway,
      identityLinker,
    });

    expect(resumed).toMatchObject({
      processed: 15,
      createdClerkUsers: 8,
      reusedClerkUsers: 7,
      linkedGuardians: 15,
    });
    expect(fakeDatabase.users.size).toBe(15);
  });

  it("preflights every database fixture before making Clerk calls", async () => {
    const seedFixtures = fixtures();
    const fakeClerk = createFakeClerk();
    const fakeDatabase = createFakeIdentityDatabase(seedFixtures);
    fakeDatabase.guardians.delete(
      fixtureId(fakeDatabase.campusId, "guardian", "guardian-015"),
    );

    await expect(
      provisionGuardianClerkAccounts({
        fixtures: seedFixtures,
        campusId: fakeDatabase.campusId,
        password: "not-logged",
        clerk: fakeClerk.gateway,
        identityLinker: new PrismaGuardianIdentityLinker(fakeDatabase.database),
      }),
    ).rejects.toThrow("Run seed:dev-data first");
    expect(fakeClerk.gateway.findUsersByEmail).not.toHaveBeenCalled();
    expect(fakeClerk.gateway.createUser).not.toHaveBeenCalled();
  });
});
