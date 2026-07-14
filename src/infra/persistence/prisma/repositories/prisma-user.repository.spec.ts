import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaService } from "../prisma.service";
import { PrismaUserRepository } from "./prisma-user.repository";

describe("PrismaUserRepository", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");
  const userRow = {
    id: "user-1",
    clerkUid: "user_clerk123",
    isActive: true,
    createdAt: now,
    updatedAt: now,
    userRoles: [],
  };

  const staffRow = {
    id: "staff-1",
    staffCode: "S-001",
    fullName: "Staff One",
    email: "staff@example.com",
    phoneNumber: "+15550000001",
    address: null,
    dateOfBirth: null,
    gender: null,
    isArchived: false,
    campusId: "campus-staff",
    userId: "user-1",
    createdAt: now,
    updatedAt: now,
  };

  const guardianRow = {
    id: "guardian-1",
    fullName: "Guardian One",
    email: "guardian@example.com",
    phoneNumber: "+15550000002",
    address: null,
    dateOfBirth: new Date("1985-03-20T00:00:00.000Z"),
    gender: "FEMALE",
    occupation: null,
    workAddress: null,
    isArchived: false,
    campusId: "campus-guardian-a",
    userId: "user-1",
    createdAt: now,
    updatedAt: now,
  };

  it("loads all active staff/guardian profiles for shared identity projection", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      ...userRow,
      staffs: [staffRow],
      guardians: [
        guardianRow,
        {
          ...guardianRow,
          id: "guardian-2",
          campusId: "campus-guardian-b",
          fullName: "Guardian Two",
        },
      ],
    });
    const prisma = { user: { findUnique } } as unknown as PrismaService;
    const repository = new PrismaUserRepository(
      prisma,
      {} as PrismaQueryService,
    );

    const user = await repository.findById("user-1");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        include: expect.objectContaining({
          staffs: {
            where: { isArchived: false },
            orderBy: { createdAt: "asc" },
          },
          guardians: {
            where: { isArchived: false },
            orderBy: { createdAt: "asc" },
          },
        }),
      }),
    );
    const include = findUnique.mock.calls[0]![0].include;
    expect(include.staffs).not.toHaveProperty("take");
    expect(include.guardians).not.toHaveProperty("take");

    expect(user?.profiles).toEqual([
      expect.objectContaining({
        type: "staff",
        id: "staff-1",
        campusId: "campus-staff",
      }),
      expect.objectContaining({
        type: "guardian",
        id: "guardian-1",
        campusId: "campus-guardian-a",
      }),
      expect.objectContaining({
        type: "guardian",
        id: "guardian-2",
        campusId: "campus-guardian-b",
      }),
    ]);
  });

  it("bulk-loads every requested actor ID without pagination", async () => {
    const actorIds = Array.from({ length: 51 }, (_, index) => `user-${index}`);
    const findMany = jest.fn().mockResolvedValue(
      actorIds.map((id) => ({
        ...userRow,
        id,
        clerkUid: `clerk-${id}`,
        staffs: [],
        guardians: [],
      })),
    );
    const prisma = { user: { findMany } } as unknown as PrismaService;
    const repository = new PrismaUserRepository(
      prisma,
      {} as PrismaQueryService,
    );

    const users = await repository.findByIds(actorIds);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: actorIds } } }),
    );
    expect(users).toHaveLength(51);
  });
});
