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
    const useCase = new AssignUsersToRoleUseCase(
      mockRoleRepository,
      mockUserRepository,
    );

    mockRoleRepository.findById.mockResolvedValue(createRole({ id: "role-1" }));
    mockUserRepository.findById.mockImplementation(async (id) =>
      createUser({ id }),
    );

    await useCase.execute("role-1", ["user-1", "user-1", "user-2"]);

    expect(mockUserRepository.findById).toHaveBeenCalledTimes(2);
    expect(mockRoleRepository.assignUsers).toHaveBeenCalledWith("role-1", [
      "user-1",
      "user-2",
    ]);
  });

  it("deduplicates user IDs before removeUsers", async () => {
    const mockRoleRepository = createMockRoleRepository();
    const mockUserRepository = createMockUserRepository();
    const useCase = new RemoveUsersFromRoleUseCase(
      mockRoleRepository,
      mockUserRepository,
    );

    mockRoleRepository.findById.mockResolvedValue(createRole({ id: "role-1" }));
    mockUserRepository.findById.mockImplementation(async (id) =>
      createUser({ id }),
    );

    await useCase.execute("role-1", ["user-1", "user-1", "user-2"]);

    expect(mockUserRepository.findById).toHaveBeenCalledTimes(2);
    expect(mockRoleRepository.removeUsers).toHaveBeenCalledWith("role-1", [
      "user-1",
      "user-2",
    ]);
  });
});
