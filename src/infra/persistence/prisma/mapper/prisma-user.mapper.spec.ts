import { PrismaUserMapper } from "./prisma-user.mapper";

describe("PrismaUserMapper", () => {
  const now = new Date("2026-07-01T00:00:00.000Z");

  const userRow = {
    id: "user-1",
    clerkUid: "user_clerk123",
    isActive: true,
    createdAt: now,
    updatedAt: now,
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
    campusId: "campus-a",
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
    campusId: "campus-b",
    userId: "user-1",
    createdAt: now,
    updatedAt: now,
  };

  it("projects every loaded active staff and guardian profile", () => {
    const user = PrismaUserMapper.toDomain({
      ...userRow,
      userRoles: [],
      staffs: [
        staffRow,
        {
          ...staffRow,
          id: "staff-2",
          campusId: "campus-c",
          fullName: "Staff Two",
        },
      ],
      guardians: [guardianRow],
    } as any);

    expect(user.profiles).toEqual([
      {
        type: "staff",
        id: "staff-1",
        campusId: "campus-a",
        fullName: "Staff One",
        email: "staff@example.com",
        phoneNumber: "+15550000001",
        dateOfBirth: null,
        gender: null,
      },
      {
        type: "staff",
        id: "staff-2",
        campusId: "campus-c",
        fullName: "Staff Two",
        email: "staff@example.com",
        phoneNumber: "+15550000001",
        dateOfBirth: null,
        gender: null,
      },
      {
        type: "guardian",
        id: "guardian-1",
        campusId: "campus-b",
        fullName: "Guardian One",
        email: "guardian@example.com",
        phoneNumber: "+15550000002",
        dateOfBirth: new Date("1985-03-20T00:00:00.000Z"),
        gender: "FEMALE",
      },
    ]);
    expect(user.profile).toMatchObject({
      type: "staff",
      id: "staff-1",
      campusId: "campus-a",
    });
  });

  it("returns an empty profiles array when no active profiles are loaded", () => {
    const user = PrismaUserMapper.toDomain({
      ...userRow,
      userRoles: [],
      staffs: [],
      guardians: [],
    } as any);

    expect(user.profiles).toEqual([]);
    expect(user.profile).toBeNull();
  });
});
