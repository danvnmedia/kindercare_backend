import { PrismaRoleRepository } from "./prisma-role.repository";
import { PrismaQueryService } from "@/core/modules/standard-response/services/prisma-query.service";
import { PrismaService } from "../prisma.service";

const ROLE_ID = "33333333-3333-4333-a333-333333333333";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";

describe("PrismaRoleRepository.getRoleMembers", () => {
  it("maps profile and provenance metadata from user_roles rows", async () => {
    const assignedAt = new Date("2026-06-26T12:00:00.000Z");
    const prisma = {
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "assignment-1",
            userId: "user-1",
            roleId: ROLE_ID,
            campusId: CAMPUS_ID,
            assignedAt,
            grantedViaStaffTypeId: "55555555-5555-4555-a555-555555555555",
            grantedViaStaffType: {
              id: "55555555-5555-4555-a555-555555555555",
              name: "Teacher",
            },
            user: {
              id: "user-1",
              clerkUid: "user_staff",
              isActive: true,
              staffs: [
                {
                  id: "staff-1",
                  fullName: "Alice Staff",
                  email: "alice@example.com",
                  phoneNumber: "+1 555 0100",
                  dateOfBirth: null,
                },
              ],
              guardians: [],
            },
          },
          {
            id: "assignment-2",
            userId: "user-2",
            roleId: ROLE_ID,
            campusId: CAMPUS_ID,
            assignedAt,
            grantedViaStaffTypeId: null,
            grantedViaStaffType: null,
            user: {
              id: "user-2",
              clerkUid: "user_guardian",
              isActive: true,
              staffs: [],
              guardians: [
                {
                  id: "guardian-1",
                  fullName: "Grace Guardian",
                  email: "grace@example.com",
                  phoneNumber: "+1 555 0101",
                  dateOfBirth: null,
                },
              ],
            },
          },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
    } as unknown as PrismaService;
    const repository = new PrismaRoleRepository(
      prisma,
      {} as PrismaQueryService,
    );

    const result = await repository.getRoleMembers(ROLE_ID, CAMPUS_ID, {
      limit: 10,
      offset: 0,
    });

    expect(prisma.userRole.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { roleId: ROLE_ID, campusId: CAMPUS_ID },
        take: 10,
        skip: 0,
      }),
    );
    expect(result.pagination.count).toBe(2);
    expect(result.data[0]).toMatchObject({
      assignmentId: "assignment-1",
      userId: "user-1",
      clerkUid: "user_staff",
      profile: {
        type: "staff",
        fullName: "Alice Staff",
      },
      provenance: {
        source: "staff_type",
        grantedViaStaffTypeId: "55555555-5555-4555-a555-555555555555",
        staffTypeName: "Teacher",
        canOverride: true,
      },
    });
    expect(result.data[0].provenance.warning).toContain("StaffType");
    expect(result.data[1]).toMatchObject({
      profile: {
        type: "guardian",
        fullName: "Grace Guardian",
      },
      provenance: {
        source: "manual",
        grantedViaStaffTypeId: null,
        staffTypeName: null,
        canOverride: false,
        warning: null,
      },
    });
  });
});
