import { PrismaGuardianRepository } from "./prisma-guardian.repository";

describe("PrismaGuardianRepository", () => {
  const createRepository = (findMany = jest.fn()) => {
    const prisma = {
      guardian: {
        findMany,
      },
    };

    return {
      findMany,
      repository: new PrismaGuardianRepository(prisma as any, {} as any),
    };
  };

  it("finds active guardian campuses by user id", async () => {
    const createdAt = new Date("2026-06-01T00:00:00.000Z");
    const updatedAt = new Date("2026-06-02T00:00:00.000Z");
    const findMany = jest.fn().mockResolvedValue([
      {
        campus: {
          id: "11111111-1111-4111-a111-111111111111",
          name: "Campus A",
          address: "123 A Street",
          phoneNumber: "+84901234567",
          isArchived: false,
          createdAt,
          updatedAt,
        },
      },
    ]);
    const { repository } = createRepository(findMany);

    const result = await repository.findActiveCampusesByUserId("user-1");

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        isArchived: false,
        campus: {
          isArchived: false,
        },
      },
      include: {
        campus: true,
      },
      orderBy: {
        campus: {
          name: "asc",
        },
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0].id.toString()).toBe(
      "11111111-1111-4111-a111-111111111111",
    );
    expect(result[0].name).toBe("Campus A");
  });

  it("returns an empty list when no active guardian campuses exist", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const { repository } = createRepository(findMany);

    await expect(
      repository.findActiveCampusesByUserId("user-1"),
    ).resolves.toEqual([]);
  });
});
