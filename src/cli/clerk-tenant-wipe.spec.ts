import {
  clerkTenantWipeExitCode,
  ClerkTenantAdminGateway,
  parseClerkTenantWipeArgs,
  readClerkTenantWipeEnvironment,
  wipeClerkTenantUsers,
} from "./clerk-tenant-wipe";

function createGateway(userIds: string[], pageSize = 2) {
  const deleteUser = jest.fn<Promise<void>, [string]>(async () => undefined);
  const listUsers = jest.fn<
    ReturnType<ClerkTenantAdminGateway["listUsers"]>,
    Parameters<ClerkTenantAdminGateway["listUsers"]>
  >(async ({ offset }) => ({
    data: userIds.slice(offset, offset + pageSize).map((id) => ({ id })),
    totalCount: userIds.length,
  }));
  return { gateway: { listUsers, deleteUser }, listUsers, deleteUser };
}

describe("Clerk tenant wipe", () => {
  it("refuses production and blank Clerk secrets", () => {
    expect(() =>
      readClerkTenantWipeEnvironment({
        NODE_ENV: "production",
        CLERK_SECRET_KEY: "secret",
      }),
    ).toThrow("permanently disabled");
    expect(() =>
      readClerkTenantWipeEnvironment({
        NODE_ENV: "development",
        CLERK_SECRET_KEY: " ",
      }),
    ).toThrow("CLERK_SECRET_KEY");
  });

  it("parses preview and exact execution arguments", () => {
    expect(parseClerkTenantWipeArgs([])).toEqual({
      execute: false,
      confirmation: undefined,
    });
    expect(
      parseClerkTenantWipeArgs([
        "--execute",
        "--confirm",
        "DELETE_ALL_CLERK_USERS",
      ]),
    ).toEqual({
      execute: true,
      confirmation: "DELETE_ALL_CLERK_USERS",
    });
    expect(() => parseClerkTenantWipeArgs(["--unknown"])).toThrow("Unknown");
  });

  it("paginates every user in preview without deleting", async () => {
    const fake = createGateway(["user_1", "user_2", "user_3", "user_4"]);
    const summary = await wipeClerkTenantUsers({
      clerk: fake.gateway,
      options: { execute: false },
      pageSize: 2,
    });

    expect(summary).toEqual({
      mode: "preview",
      discovered: 4,
      deleted: 0,
      failed: 0,
      failedUserIds: [],
    });
    expect(fake.listUsers.mock.calls.map(([input]) => input.offset)).toEqual([
      0, 2,
    ]);
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects missing or incorrect confirmation before listing", async () => {
    const fake = createGateway(["user_1"]);

    await expect(
      wipeClerkTenantUsers({
        clerk: fake.gateway,
        options: { execute: true, confirmation: "wrong" },
      }),
    ).rejects.toThrow("--execute --confirm DELETE_ALL_CLERK_USERS");
    expect(fake.listUsers).not.toHaveBeenCalled();
    expect(fake.deleteUser).not.toHaveBeenCalled();
  });

  it("continues after deletion failures and reports every failed ID", async () => {
    const fake = createGateway(["user_1", "user_2", "user_3", "user_4"]);
    fake.deleteUser.mockImplementation(async (userId) => {
      if (userId === "user_2" || userId === "user_4") {
        throw new Error("simulated failure");
      }
    });

    const summary = await wipeClerkTenantUsers({
      clerk: fake.gateway,
      options: {
        execute: true,
        confirmation: "DELETE_ALL_CLERK_USERS",
      },
      pageSize: 2,
    });

    expect(fake.deleteUser.mock.calls.map(([userId]) => userId)).toEqual([
      "user_1",
      "user_2",
      "user_3",
      "user_4",
    ]);
    expect(summary).toEqual({
      mode: "execute",
      discovered: 4,
      deleted: 2,
      failed: 2,
      failedUserIds: ["user_2", "user_4"],
    });
    expect(clerkTenantWipeExitCode(summary)).toBe(1);
  });

  it("succeeds against an empty tenant", async () => {
    const fake = createGateway([]);
    const summary = await wipeClerkTenantUsers({
      clerk: fake.gateway,
      options: {
        execute: true,
        confirmation: "DELETE_ALL_CLERK_USERS",
      },
    });

    expect(summary).toEqual({
      mode: "execute",
      discovered: 0,
      deleted: 0,
      failed: 0,
      failedUserIds: [],
    });
    expect(fake.deleteUser).not.toHaveBeenCalled();
    expect(clerkTenantWipeExitCode(summary)).toBe(0);
  });
});
