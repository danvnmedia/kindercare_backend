import { BadRequestException } from "@nestjs/common";

import { Role } from "@/domain/user-management/role.entity";
import { createMockRoleRepository } from "@/test-utils";

import { RoleRepository } from "../../ports/role.repository";
import { GetRoleMembersUseCase } from "./get-role-members.use-case";

const ROLE_ID = "33333333-3333-4333-a333-333333333333";
const CAMPUS_ID = "11111111-1111-4111-a111-111111111111";
const OTHER_CAMPUS_ID = "22222222-2222-4222-a222-222222222222";

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
    id: ROLE_ID,
    name: "Teacher",
    description: null,
    campusId: CAMPUS_ID,
    isSystemDefault: false,
    isSystemRole: false,
    permissions: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("GetRoleMembersUseCase", () => {
  let roleRepo: jest.Mocked<RoleRepository>;
  let useCase: GetRoleMembersUseCase;

  beforeEach(() => {
    roleRepo = createMockRoleRepository();
    useCase = new GetRoleMembersUseCase(roleRepo);
  });

  it("rejects wrong-campus role membership reads before querying members", async () => {
    roleRepo.findById.mockResolvedValue(
      makeRole({ campusId: OTHER_CAMPUS_ID }),
    );

    await expect(
      useCase.execute({
        roleId: ROLE_ID,
        campusId: CAMPUS_ID,
        params: { limit: 10, offset: 0 },
      }),
    ).rejects.toThrow(BadRequestException);

    expect(roleRepo.getRoleMembers).not.toHaveBeenCalled();
  });

  it("delegates campus-scoped member reads to the repository", async () => {
    roleRepo.findById.mockResolvedValue(makeRole());
    roleRepo.getRoleMembers.mockResolvedValue({
      data: [],
      pagination: {
        count: 0,
        limit: 10,
        offset: 0,
        totalPages: 0,
        currentPage: 1,
        hasNext: false,
        hasPrev: false,
      },
    });

    await useCase.execute({
      roleId: ROLE_ID,
      campusId: CAMPUS_ID,
      params: { limit: 10, offset: 0 },
    });

    expect(roleRepo.getRoleMembers).toHaveBeenCalledWith(ROLE_ID, CAMPUS_ID, {
      limit: 10,
      offset: 0,
    });
  });
});
