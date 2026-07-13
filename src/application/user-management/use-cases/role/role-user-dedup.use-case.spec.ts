import { AssignUsersToRoleUseCase } from "./assign-users-to-role.use-case";
import { RemoveUsersFromRoleUseCase } from "./remove-users-from-role.use-case";
import {
  createMockRoleRepository,
  createMockUserRepository,
  createRole,
  createUser,
} from "@/test-utils";

describe("Role User Dedup Use Cases", () => {
  it("deduplicates user IDs before assignUsers", async () => {
    const mockRoleRepository = createMockRoleRepository();
    const mockUserRepository = createMockUserRepository();
    const mockUnitOfWork = {
      run: jest.fn(async (callback) =>
        callback({
          assignRoles: jest.fn(async () => 1),
          recordAudit: jest.fn(),
        }),
      ),
    };
    const useCase = new AssignUsersToRoleUseCase(
      mockRoleRepository,
      mockUserRepository,
      mockUnitOfWork as any,
    );

    mockRoleRepository.findById.mockResolvedValue(
      createRole({ id: "role-1", campusId: "campus-1" }),
    );
    mockUserRepository.findById.mockImplementation(async (id) =>
      createUser({ id }),
    );

    await useCase.execute(
      {
        roleId: "role-1",
        userIds: ["user-1", "user-1", "user-2"],
        campusId: "campus-1",
      },
      createUser({ id: "admin-1" }),
    );

    expect(mockUserRepository.findById).toHaveBeenCalledTimes(2);
    expect(mockUnitOfWork.run).toHaveBeenCalledTimes(1);
  });

  it("deduplicates user IDs before removeUsers", async () => {
    const mockRoleRepository = createMockRoleRepository();
    const mockUserRepository = createMockUserRepository();
    const mockUnitOfWork = {
      run: jest.fn(async (callback) =>
        callback({
          revokeRoles: jest.fn(async () => 1),
          recordAudit: jest.fn(),
        }),
      ),
    };
    const useCase = new RemoveUsersFromRoleUseCase(
      mockRoleRepository,
      mockUserRepository,
      mockUnitOfWork as any,
    );

    mockRoleRepository.findById.mockResolvedValue(
      createRole({ id: "role-1", campusId: "campus-1" }),
    );
    mockUserRepository.findById.mockImplementation(async (id) =>
      createUser({ id }),
    );

    await useCase.execute(
      {
        roleId: "role-1",
        userIds: ["user-1", "user-1", "user-2"],
        campusId: "campus-1",
      },
      createUser({ id: "admin-1" }),
    );

    expect(mockUserRepository.findById).toHaveBeenCalledTimes(2);
    expect(mockUnitOfWork.run).toHaveBeenCalledTimes(1);
  });
});
